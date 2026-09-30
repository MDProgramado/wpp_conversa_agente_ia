# notify.ps1 — notificação local de primeira parte (R-013, D-07)
#
# Notificação NÍVEL LOCAL implementada de primeira parte sobre WinRT, sem
# wrapper de terceiros. Motivo da decisão (STACK.md §Windows Notifications):
# o pacote que faria isso por conveniência está sem push desde 2024-06-24, no
# Windows não chama WinRT — escreve um .ps1 temporário e invoca o PowerShell,
# herdando todas as fraquezas do PowerShell — e é anterior ao requisito do
# Windows 10 1709+ de que o toast carregue um AppUserModelID registrado. Sem
# AUMID, o toast aparece com nome genérico ou é descartado em silêncio.
# O Biome mantém a regra `noRestrictedImports` que impede a dependência.
#
# Este script registra o AUMID e emite o toast pelo WinRT diretamente.
#
# O `-ExecutionPolicy Bypass` em quem o invoca é obrigatório e é a razão de este
# arquivo ser dependência de RUNTIME, não passo de instalação.

param(
    [Parameter(Mandatory = $false)][string]$Title = "Automação",
    [Parameter(Mandatory = $false)][string]$Message = "",
    # `-Sound` é opt-in porque o plano documenta o comando humano sem ele. Com
    # `-Urgent` sem `-Sound`, o alerta visual é o sinal; com `-Sound`, há
    # também o som do sistema.
    [Parameter(Mandatory = $false)][switch]$Urgent,
    [Parameter(Mandatory = $false)][switch]$Sound,
    # Verificação: faz tudo menos exibir o toast. Serve para o <automated> da
    # task 6 rodar sem depender de a sessão ter o Foco Assistente desligado.
    [Parameter(Mandatory = $false)][switch]$LogOnly,
    [Parameter(Mandatory = $false)][string]$FilePath
)

$ErrorActionPreference = "Stop"

$LogDir = "C:\whatsapp_prospecao\logs"
$LogFile = Join-Path $LogDir "notifications.log"
$Aumid = "WhatsAppProspect.Automacao"
# Atalho no Menu Iniciar. É ele que CARREGA o AUMID — o registro do AUMID no
# Windows 11 acontece por property store do IShellLink, não por uma chamada
# WinRT (ver Register-Aumid abaixo).
$LnkPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\WhatsAppProspect.lnk"

function Write-NotificationLog {
    param([string]$Event, [string]$Detail)
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
    # O titulo NAO vai para o log: ele pode carregar trecho de conversa com o lead
    # e o arquivo de log sobrevive a rotacao de retencao (R-064, T-01-11). O
    # comprimento responde "quanto" sem "o que". Append, nunca sobrescreve: o
    # historico e o registro de que o Admin foi avisado (R-013, R-022).
    $line = "{0} event={1} title_chars={2} detail={3}" -f `
        (Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"), $Event, $Title.Length, $Detail
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Initialize-DataDir {
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
}

# ---------------------------------------------------------------------------
# Register-Aumid
#
# `ToastNotificationManager.RegisterAumid` não é acessível do Windows PowerShell
# 5.1: a projeção WinRT exposta aqui é a do *cliente* (WinRTWinRT.dll em
# Windows 10 1709+), e nem `CreateOnDemandToastNotifier` nem
# `AppUserModelIdDescriptor` fazem parte dela. Verificado nesta máquina: um
# devolve "não contém um método", o outro "não é possível localizar o tipo".
#
# O caminho suportado para app Win32 despacotado é gravar
# `PKEY_AppUserModel_ID` (System.AppUserModel.ID) no atalho do Menu Iniciar via
# `IPersistPropertyStore`, e o Windows registra o AUMID no primeiro clique.
#
# O registro é BEST-EFFORT e seu erro é logged, nunca fatal. Raciocínio: AUMID
# controla o NOME que aparece no toast, não a emissão. Um registro que falha não
# pode impedir a notificação — R-013 exige que o Admin seja avisado, e um
# registro de branding que bloqueia o alerta é um risco maior que o nome
# genérico que ele evita. O `CreateToastNotifier` abaixo funciona com o AUMID
# registrado ou não; sem registro, o Windows mostra o nome do host.
# ---------------------------------------------------------------------------
function Register-Aumid {
    $lnkDir = Split-Path $LnkPath -Parent
    if (-not (Test-Path $lnkDir)) {
        New-Item -ItemType Directory -Path $lnkDir -Force | Out-Null
    }

    # Passo 1: garantir o atalho. O alvo é o launcher; o atalho existe
    # essencialmente para carregar o AUMID.
    if (-not (Test-Path $LnkPath)) {
        $shell = New-Object -ComObject WScript.Shell
        $sc = $shell.CreateShortcut($LnkPath)
        $sc.TargetPath = "C:\whatsapp_prospecao\automacao.cmd"
        $sc.Save()
    }

    # Passo 2: gravar a property store. Isolado em try/catch próprio para que
    # uma falha de COM não suba e mate a notificação.
    try {
        if (-not ("AumidReg" -as [type])) {
            $src = @"
using System;
using System.Runtime.InteropServices;
public struct PROPERTYKEY { public Guid fmtid; public uint pid; }
[StructLayout(LayoutKind.Explicit, Size=24)]
public struct PROPVARIANT { [FieldOffset(0)] public ushort vt; [FieldOffset(8)] public IntPtr lpwstr; }
[ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPersistPropertyStore2 {
  void GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
  void SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
  void Commit();
}
public static class AumidReg {
  [DllImport("ole32.dll")] static extern void CoTaskMemFree(IntPtr p);
  public static string SetOn(string appId) {
    try {
      Type t = Type.GetTypeFromCLSID(new Guid("00021401-0000-0000-C000-000000000046"));
      object link = Activator.CreateInstance(t);
      IPersistPropertyStore2 store = (IPersistPropertyStore2)link;
      PROPERTYKEY key = new PROPERTYKEY();
      key.fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
      key.pid = 5;
      IntPtr mem = Marshal.StringToCoTaskMemUni(appId);
      PROPVARIANT pv = new PROPVARIANT(); pv.vt = 31; pv.lpwstr = mem;
      try { store.SetValue(ref key, ref pv); } finally { CoTaskMemFree(mem); }
      store.Commit();
      return "ok";
    } catch (Exception ex) { return ex.GetType().Name + ": " + ex.Message; }
  }
}
"@
            Add-Type -TypeDefinition $src -Language CSharp
        }
        $resultado = [AumidReg]::SetOn($Aumid)
        if ($resultado -eq "ok") {
            Write-NotificationLog -Event "aumid_registered" -Detail $Aumid
        }
        else {
            Write-NotificationLog -Event "aumid_registration_skipped" -Detail $resultado
        }
    }
    catch {
        Write-NotificationLog -Event "aumid_registration_skipped" -Detail $_.Exception.Message
    }
}

try {
    Initialize-DataDir

    # --- 1. AppUserModelID -------------------------------------------------
    # Tentado uma vez por sessão de notificação; o resultado fica registrado
    # no log mesmo quando falha, porque "registrou o AUMID" é item verificável.
    Register-Aumid

    # --- 2. Som ------------------------------------------------------------
    # Toca ANTES do toast: se a sessão de áudio estiver em erro, o script
    # falharia depois de já ter emitido o toast e o R-013 perderia a notificação
    # silenciosamente. O som é o sinal mais difícil de o Windows descartar.
    if ($Sound -and -not $LogOnly) {
        try {
            if ($Urgent) {
                [System.Media.SystemSounds]::Hand.Play()
            }
            else {
                [System.Media.SystemSounds]::Asterisk.Play()
            }
            Write-NotificationLog -Event "sound_played" -Detail "asterisk"
        }
        catch {
            # Som é acessório: a notificação é o que importa (R-013 é sobre o
            # toast). Falha de som não pode abortar a emissão.
            Write-NotificationLog -Event "sound_failed" -Detail $_.Exception.Message
        }
    }

    if ($LogOnly) {
        Write-NotificationLog -Event "toast_skipped" -Detail "LogOnly"
        exit 0
    }

    # --- 3. Toast ----------------------------------------------------------
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null

    $titulo = [System.Security.SecurityElement]::Escape($Title)
    $corpo = [System.Security.SecurityElement]::Escape($Message)

    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml(
        "<toast launch='action' scenario='reminder'><visual>" +
        "<binding template='ToastGeneric'>" +
        "<text>$titulo</text>" +
        "<text>$corpo</text>" +
        "</binding></visual>" +
        "</toast>")

    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)

    # `scenario='reminder'` faz o toast persistir na Central de Notificações em
    # vez de sumir. `-Urgent` estende a expiração, que é o mais próximo de
    # "quebrar o Foco Assistente" que o script pode fazer sem trazer a
    # dependência de instalação do módulo BurntToast.
    if ($Urgent) {
        $toast.ExpirationTime = [DateTimeOffset]::Now.AddMinutes(10)
    }

    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($Aumid)
    $notifier.Show($toast)

    Write-NotificationLog -Event "toast_sent" -Detail "urgent=$Urgent sound=$Sound"

    if ($FilePath) {
        Write-NotificationLog -Event "file_attached" -Detail $FilePath
    }
    exit 0
}
catch {
    Write-NotificationLog -Event "toast_failed" -Detail $_.Exception.Message
    exit 1
}
