@echo off
REM ============================================================================
REM  scripts\launch.cmd -- NFRQ-01: sobe o PostgreSQL e a aplicacao SEM
REM  privilegio administrativo. Este e o launcher do Agendador de Tarefas, que
REM  roda no logon do usuario, numa sessao NAO administrativa.
REM
REM  Por que pg_isready + pg_ctl e nao um comando de servico do Windows: o
REM  servico do PostgreSQL esta em estado MANUAL e iniciar servico do Windows
REM  exige elevacao. O boot do dia a dia roda sem privilegios, e pg_isready e
REM  pg_ctl funcionam sem elevacao. Trocar por comando de servico faria o boot
REM  depender de administrador e falhar.
REM
REM  Uso:
REM    scripts\launch.cmd          boot de producao: o processo fica VIVO
REM    scripts\launch.cmd check    boot completo e devolve exit 0 (gate)
REM
REM  O modo `check` existe porque um boot que fica vivo nunca devolve o prompt.
REM  Qualquer verificacao do launcher que espere o exit 0 ficaria pendurada para
REM  sempre, e um gate pendurado nao e um gate.
REM ============================================================================
setlocal

set "PGBIN=C:\Program Files\PostgreSQL\18\bin"
set "PGDATA=C:\Program Files\PostgreSQL\18\data"
set "DATA_ROOT=C:\whatsapp_prospecao"

REM O .env do repo tem precedencia sobre o default acima (D-01). Se o .env nao
REM existir, o findstr nao itera e DATA_ROOT mantem o default -- que e o que
REM segura o boot antes de o .env ser criado.
REM
REM O for fica de proposito FORA de qualquer if. Dentro de um bloco entre
REM parenteses o parser do cmd embaralha o `in (...)` do for e o launcher morre
REM com "inesperado neste momento" -- e o default de C:\whatsapp_prospecao e o que
REM impede a sessao do Baileys de nascer dentro do OneDrive.
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b "DATA_ROOT=" "%~dp0..\.env" 2^>nul`) do set "DATA_ROOT=%%B"

if not exist "%DATA_ROOT%\logs" mkdir "%DATA_ROOT%\logs"

REM --- (1) O PostgreSQL ja esta no ar? ----------------------------------------
"%PGBIN%\pg_isready.exe" -h 127.0.0.1 -q
if errorlevel 1 (
  echo [launch] PostgreSQL parado. Subindo com pg_ctl -- sem elevacao...
  "%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -l "%DATA_ROOT%\logs\pg.log" -w -t 30 start
)

REM --- (2) Segunda checagem, COM espera ---------------------------------------
REM O recovery do PostgreSQL 18 leva 10-16s na primeira inicializacao e, durante
REM ele, o servidor responde "rejecting connections". Checagem unica daria falso
REM negativo e o app subiria sem banco; -t 60 segura a espera.
"%PGBIN%\pg_isready.exe" -h 127.0.0.1 -q -t 60
if errorlevel 1 (
  echo [launch] PostgreSQL nao respondeu em 60s. Abortando.
  exit /b 1
)
echo [launch] PostgreSQL pronto.

REM --- (3) Fuso ANTES do processo --------------------------------------------
REM A janela 7h-17h (R-006) e avaliada no fuso de Sao Paulo. Se o processo herdar
REM o fuso da maquina, o gate abre e fecha na hora errada -- e a janela e
REM exatamente o que impede o envio fora de horario.
set "TZ=America/Sao_Paulo"

if /i "%~1"=="check" set "BOOT_CHECK_ONLY=1"

echo [launch] Subindo a aplicacao (tsx src\index.ts)...
npx tsx src/index.ts
exit /b %ERRORLEVEL%
