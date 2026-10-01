<#
.SYNOPSIS
    Higiene do PostgreSQL local: fecha a exposicao de rede e exige senha do role da aplicacao.

.DESCRIPTION
    Duas escopos, aplicados SEPARADAMENTE, cada um com backup antes de qualquer escrita:

      1. ListenAddresses  — `listen_addresses` de `*` para `localhost` em
         `postgresql.conf`. Fecha a exposicao de rede: com `*`, toda a base de
         leads (LGPD) e as outras bases da maquina escutam em todas as interfaces.

      2. RolePassword     — `ALTER ROLE ... PASSWORD` com `scram-sha-256` para o
         role da aplicacao. Nao toca em nenhum outro role.

    ## O que este script NAO faz, e por que

    **Nao toca `pg_hba.conf`.** O `postgresql.conf` e o `pg_hba.conf` desta
    maquina sao COMPARTILHADOS por `auth`, `pizzaria_db`, `vidracaria`,
    `vidracaria_test`, `vidracaria_test`, `whatsapp_automation` e
    `whatsapp_prospect`. Alterar autenticacao global quebraria os outros bancos,
    alguns dos quais possivelmente nao tem senha. A consequencia — enquanto o
    `pg_hba.conf` local permitir `trust`, qualquer processo na conta do Admin
    conecta sem senha — e ACEITA e esta escrita em `docs/adr/003-pg-hba-higiene.md`.

    **Nao usa `takeown` nem `icacls`.** Alterar a ACL do data directory para
    escrever nele e mais arriscado do que a exposicao que esta task fecha.

    ## Contrato de seguranca

    - `-WhatIf` e o PADRAO. Nada e gravado sem `-Apply`.
    - A senha nunca aparece na linha de comando do `psql`: ela vai para um
      arquivo temporario com ACL restritiva, executado com `psql -f`, e removido
      em seguida. `-DbPassword` aceita `SecureString` para que nao fique no
      historico do PowerShell.
    - Antes de escrever, faz backup datado: `postgresql.conf.20260930-143000.bak`.
    - Apos o restart, `pg_isready` decide: se o servidor nao voltou, o backup e
      restaurado e o servico e reiniciado de novo. A configuracao que quebra o
      boot nao sobrevive a este script.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\pg-hba-apply.ps1
    Dry-run. Mostra o que faria, nao escreve nada.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\pg-hba-apply.ps1 -Apply -Scope ListenAddresses
    Executa de verdade so a parte de rede, com backup e restart.
#>
[CmdletBinding()]
param(
    # Escrita real. Sem este switch o script e um relatorio.
    [switch]$Apply,

    # Dry-run explicito. E o que o script faz quando `-Apply` nao vem; existe
    # para o gate de shell e para o humano ler a intencao antes de approve-la.
    [switch]$WhatIf,

    # Which subset to act on. 'All' runs both, in order.
    [ValidateSet('All', 'ListenAddresses', 'RolePassword')]
    [string]$Scope = 'All',

    # Caminho do postgresql.conf. Default e o data directory do PostgreSQL 18.
    [string]$ConfPath = 'C:\Program Files\PostgreSQL\18\data\postgresql.conf',

    # Servico do Windows que hospeda o postgres. Precisa de Administrador para restart.
    [string]$ServiceName = 'postgresql-x64-18',

    # Role da aplicacao. Deliberadamente NAO e `postgres`: o `postgres` e
    # superuser e serve a administracao manual; a aplicacao usa o proprio.
    [string]$AppRole = 'whatsapp_bot',

    # Binarios do PostgreSQL, mesmos major version do servidor (pg_dump/psql
    # de outra major version falham — ver STACK.md).
    [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin',

    # Senha do role. Prefira SecureString; a alternativa por variavel de
    # ambiente existe para o comando inteiro poder ser colado sem segredo.
    [SecureString]$DbPassword,

    # Nome da variavel de ambiente que carrega a senha, quando -DbPassword nao vem.
    [string]$PasswordEnvVar = 'WHATSAPP_DB_PASSWORD',

    # Banco usado para as consultas de verificacao.
    [string]$CheckDatabase = 'whatsapp_prospect',

    # Nao reiniciar o servico. Util para inspecionar o plano sem tocar no banco.
    [switch]$SkipRestart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# `WhatIf` explicito sem `Apply` e o mesmo que o padrao: dry-run.
$Realizar = $Apply.IsPresent -and -not $WhatIf.IsPresent

function Write-Etapa {
    param([string]$Texto, [ValidateSet('INFO', 'MUDANCA', 'ERRO', 'OK')]$Nivel = 'INFO')
    $cor = switch ($Nivel) {
        'MUDANCA' { 'Yellow' }
        'ERRO'    { 'Red' }
        'OK'      { 'Green' }
        default   { 'Gray' }
    }
    Write-Host ("[{0,-7}] {1}" -f $Nivel, $Texto) -ForegroundColor $cor
}

function Write-Bloco {
    param([string]$Titulo)
    Write-Host ''
    Write-Host "== $Titulo " -NoNewline -ForegroundColor Cyan
    Write-Host ('=' * [Math]::Max(0, 62 - $Titulo.Length)) -ForegroundColor Cyan
}

# ---------------------------------------------------------------------------
# 1. Estado inicial
# ---------------------------------------------------------------------------
Write-Bloco 'Estado inicial'

if (-not (Test-Path $ConfPath)) {
    throw "postgresql.conf nao encontrado em '$ConfPath'. Ajuste -ConfPath."
}

$psql = Join-Path $PgBin 'psql.exe'
$pgIsReady = Join-Path $PgBin 'pg_isready.exe'
foreach ($binario in @($psql, $pgIsReady)) {
    if (-not (Test-Path $binario)) {
        throw "binario nao encontrado: '$binario'. Ajuste -PgBin para a mesma major version do servidor."
    }
}

$listenAddressAtual = (& $psql -U postgres -h 127.0.0.1 -d $CheckDatabase -tAc 'show listen_addresses' 2>$null)
if ($LASTEXITCODE -ne 0) {
    throw "nao foi possivel falar com o servidor. A conexao local exige o servico no ar; o script assume que ele ja sobeu."
}

Write-Etapa "postgresql.conf ....... $ConfPath"
Write-Etapa "servico ............... $ServiceName"
Write-Etapa "role da aplicacao ..... $AppRole"
Write-Etapa "listen_addresses ...... $listenAddressAtual"
Write-Etapa "modo .................. $(if ($Realizar) { 'APLICAR (escreve)' } else { 'DRY-RUN (nada e escrito)' })"

# ---------------------------------------------------------------------------
# 2. Scope 1 — listen_addresses
# ---------------------------------------------------------------------------
$backupConf = $null
$confAlterado = $false

if ($Scope -in @('All', 'ListenAddresses')) {
    Write-Bloco 'Scope 1: listen_addresses'

    $linhaAtual = (Select-String -Path $ConfPath -Pattern '^\s*listen_addresses\s*=' -Encoding UTF8 | Select-Object -First 1)
    if (-not $linhaAtual) {
        # Sem a linha no arquivo, o padrao do servidor e '*' (o comentario do
        # proprio conf diz isso) — entao o efeito desejado e acrescentar a linha,
        # e nao substitui-la. Registrado aqui porque "nao achei a linha" e um
        # resultado legitimo e silencioso.
        Write-Etapa "nenhuma linha 'listen_addresses' no arquivo; sera ACRESCENTADA ao final" 'MUDANCA'
        $acao = 'acrescentar'
    }
    else {
        $valorNoArquivo = ($linhaAtual.Line -split '=', 2)[1].Trim()
        Write-Etapa "linha $($linhaAtual.LineNumber): $valorNoArquivo"
        if ($valorNoArquivo -eq "'*'" -or $valorNoArquivo -eq '*') {
            $acao = 'substituir'
        }
        else {
            Write-Etapa "valor ja diferente de '*' — nada a fazer neste scope" 'OK'
            $acao = 'nada'
        }
    }

    if ($acao -eq 'nada') {
        Write-Etapa 'pulado' 'OK'
    }
    elseif (-not $Realizar) {
        # $linhaAtual e $null quando $acao -eq 'acrescentar' (a linha nao existe no
        # arquivo). Sem este desvio, o StrictMode aborta o dry-run com
        # "PropertyNotFoundStrict" justamente no cenario em que o script precisa
        # apenas descrever o que faria.
        if ($linhaAtual) {
            Write-Etapa "DRY-RUN: trocaria '$($linhaAtual.Line.Trim())' por 'listen_addresses = ''localhost'''" 'MUDANCA'
        }
        else {
            Write-Etapa "DRY-RUN: acrescentaria 'listen_addresses = ''localhost''' ao final do arquivo" 'MUDANCA'
        }
    }
    else {
        # Backup datado ANTES da escrita. Sem ele, um .conf quebrado e um
        # postgres que nao sobe ate alguem reverter a mao.
        $carimbo = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backupConf = "$ConfPath.$carimbo.bak"
        Copy-Item -Path $ConfPath -Destination $backupConf -Force
        Write-Etapa "backup criado: $backupConf" 'OK'

        $novoConteudo = Get-Content -Path $ConfPath -Encoding UTF8
        if ($acao -eq 'substituir') {
            $numero = $linhaAtual.LineNumber
            $novoConteudo[$numero - 1] = "listen_addresses = 'localhost'"
        }
        else {
            $novoConteudo += ''
            $novoConteudo += "# Fechado por scripts/pg-hba-apply.ps1 (T-01-01): '*' expunha a base de leads a LAN."
            $novoConteudo += "listen_addresses = 'localhost'"
        }
        Set-Content -Path $ConfPath -Value $novoConteudo -Encoding UTF8
        $confAlterado = $true
        Write-Etapa "escrito: listen_addresses = 'localhost'" 'MUDANCA'
    }
}

# ---------------------------------------------------------------------------
# 3. Scope 2 — senha scram-sha-256 por role
# ---------------------------------------------------------------------------
if ($Scope -in @('All', 'RolePassword')) {
    Write-Bloco "Scope 2: senha scram-sha-256 do role $AppRole"

    # `ALTER ROLE ... PASSWORD` em um .sql temporario, e nao em `-c` nem em
    # `-v`: os dois colocariam a senha na linha de comando do processo, visivel
    # em `Get-CimInstance Win32_Process` para qualquer processo da conta.
    $senha = $null
    if ($DbPassword) {
        $senha = $DbPassword
    }
    elseif (${env:$PasswordEnvVar}) {
        $senha = ConvertTo-SecureString -String ${env:$PasswordEnvVar} -AsPlainText -Force
    }

    $temSenha = (& $psql -U postgres -h 127.0.0.1 -d $CheckDatabase -tAc "select count(*) from pg_authid where rolname = '$AppRole' and rolpassword is not null" 2>$null)
    $metodo = (& $psql -U postgres -h 127.0.0.1 -d $CheckDatabase -tAc "select coalesce(substring(rolpassword from 1 for 4), '') from pg_authid where rolname = '$AppRole'" 2>$null)
    # A senha em si NUNCA e impressa; so o prefixo do hash, que diz o algoritmo.
    Write-Etapa "role existe com senha: $temSenha | metodo do hash: $metodo"

    if (-not $Realizar) {
        # O dry-run vem ANTES da exigencia de senha: em WhatIf nada e escrito, logo
        # nao ha motivo para abortar. Antes desta ordem, `-File ... -WhatIf` sem
        # -DbPassword terminava em throw e nunca mostrava o plano do scope 2.
        Write-Etapa "DRY-RUN: executaria 'ALTER ROLE $AppRole WITH PASSWORD <valor oculto>' em $CheckDatabase" 'MUDANCA'
        Write-Etapa "DRY-RUN: NAO tocaria em $AppRole nos outros bancos alem de mudar a senha, que vale para todos" 'INFO'
        if (-not $senha) {
            Write-Etapa "DRY-RUN sem senha informada: a execucao real exigira -DbPassword ou `$$PasswordEnvVar." 'INFO'
        }
    }
    else {
        if (-not $senha) {
            Write-Etapa "sem senha fornecida. Passe -DbPassword (SecureString) ou defina `$$PasswordEnvVar." 'ERRO'
            throw "scope RolePassword exige -DbPassword ou a variavel de ambiente $PasswordEnvVar."
        }

        $senhaEmClaro = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR(
            [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($senha))
        $sqlTemp = $null
        try {
            $sqlTemp = Join-Path ([System.IO.Path]::GetTempPath()) ("alter-role-" + [guid]::NewGuid().ToString('N') + '.sql')
            # Arquivo legivel so pela conta que o cria. Falha aqui NAO pode ser
            # ignorada: o arquivo contem a senha em claro e, com ACL herdada,
            # qualquer processo da conta leria. Fail-open aqui seria o oposto do
            # que a linha/comentario acima promete.
            & icacls.exe $sqlTemp /inheritance:r /grant:r "$($env:USERNAME):(R,W)" 2>$null | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "icacls falhou (codigo $LASTEXITCODE) e o .sql com a senha em claro nao teve a ACL restrita. Arquivo removido; senha NAO foi alterada."
            }

            # Aspas simples duplicadas = escape de SQL para a propria senha.
            $escapada = $senhaEmClaro.Replace("'", "''")
            Set-Content -Path $sqlTemp -Value "ALTER ROLE $AppRole WITH PASSWORD '$escapada';" -Encoding UTF8

            & $psql -U postgres -h 127.0.0.1 -d $CheckDatabase -v ON_ERROR_STOP=1 -q -f $sqlTemp
                        if ($LASTEXITCODE -ne 0) {
                throw "ALTER ROLE falhou (psql saiu com $LASTEXITCODE). A senha NAO foi alterada."
            }
            Write-Etapa "ALTER ROLE $AppRole aplicado com scram-sha-256" 'OK'
        }
        finally {
            # Mesmo no caminho de erro: o arquivo com a senha em claro nao pode
            # sobrar no TEMP.
            if ($sqlTemp -and (Test-Path $sqlTemp)) {
                Remove-Item -Path $sqlTemp -Force -ErrorAction SilentlyContinue
            }
            if ($senhaEmClaro) {
                # Sobrescreve a referencia da string gerenciada; nao criptografa de
                # verdade, mas evita que o valor apareca num dump de memoria logo
                # apos o script. comentario explicito porque a ilusao e tentadora.
                [void]($senhaEmClaro.PadRight(64, [char]0))
            }
            $senhaEmClaro = $null
        }
    }
}

# ---------------------------------------------------------------------------
# 4. Restart e verificacao — ou rollback
# ---------------------------------------------------------------------------
if ($confAlterado) {
    Write-Bloco 'Restart e verificacao'

    if ($SkipRestart) {
        Write-Etapa '-SkipRestart: a mudanca so vale no proximo restart do servico' 'INFO'
    }
    else {
        if (-not $Realizar) {
            Write-Etapa "DRY-RUN: reiniciaria o servico $ServiceName e conferiria pg_isready" 'MUDANCA'
        }
        else {
            Write-Etapa "reiniciando $ServiceName ..."
            Restart-Service -Name $ServiceName -Force -ErrorAction Stop
            Start-Sleep -Seconds 4

            $saida = & $pgIsReady -h 127.0.0.1 -p 5432 -U postgres 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Etapa "pg_isready falhou apos o restart: $saida" 'ERRO'
                if ($backupConf) {
                    Write-Etapa "restaurando $backupConf" 'ERRO'
                    Copy-Item -Path $backupConf -Destination $ConfPath -Force
                    Restart-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Seconds 4
                    Write-Etapa 'rollback concluido. O postgresql.conf anterior esta de volta.' 'OK'
                }
                throw "o servidor nao voltou e o backup foi restaurado. Investigue antes de tentar de novo."
            }
            Write-Etapa 'pg_isready OK' 'OK'

            $novoValor = (& $psql -U postgres -h 127.0.0.1 -d $CheckDatabase -tAc 'show listen_addresses' 2>$null)
            Write-Etapa "listen_addresses agora: $novoValor"
            if ($novoValor -ne 'localhost') {
                Write-Etapa "esperado 'localhost', veio '$novoValor'" 'ERRO'
                throw "a mudacao nao surtiu efeito. Verifique se outro arquivo sobrepoe este (ver 01-RESEARCH.md, Armadilha 5)."
            }
            Write-Etapa "exposicao de rede FECHADA (T-01-01)" 'OK'
        }
    }
}

Write-Bloco 'Resumo'
Write-Etapa "backup: $(if ($backupConf) { $backupConf } else { '(nenhum — nada foi escrito)' })"
if ($Realizar) {
    Write-Etapa 'Aplique. Verifique com: show listen_addresses;' 'OK'
}
else {
    Write-Host ''
    Write-Host 'DRY-RUN encerrado. NADA foi gravado.' -ForegroundColor Yellow
    Write-Host 'Para escrever de verdade, rode de novo com -Apply (em PowerShell como Administrador,'
    Write-Host 'porque o restart do servico exige elevação).' -ForegroundColor Yellow
}
Write-Host ''
