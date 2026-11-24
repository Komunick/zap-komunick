# Zap Komunick: instala (ou remove) o alerta de chamados de suporte no Windows
# de quem atende. Nao precisa de administrador: tudo fica na conta do usuario.
#
#   Instalar ou trocar a chave:  .\instalar.ps1 -Chave sca_...
#   Instalar pedindo a chave:    .\instalar.ps1
#   Outro endereco ou intervalo: .\instalar.ps1 -Url https://... -Intervalo 60
#   Remover tudo:                .\instalar.ps1 -Remover
#
# A chave sai de POST /support/alert-token, feito por um superadministrador.
[CmdletBinding()]
param(
    [string]$Chave,
    [string]$Url = 'https://superchat.komunick.com',
    [int]$Intervalo = 30,
    # Repete o aviso a cada tantos minutos enquanto houver chamado esperando. 0 = so avisa a novidade.
    [int]$RelembrarMinutos = 0,
    [switch]$Remover,
    # Instala sem deixar o alerta rodando (ele comeca no proximo logon).
    [switch]$SemIniciar
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# Aberto a partir do PowerShell 7, o 5.1 herda a lista de modulos do 7 e nao
# consegue carregar os proprios. Aqui ela volta ao padrao do 5.1.
if ($PSVersionTable.PSVersion.Major -le 5) {
    $env:PSModulePath = @(
        (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'WindowsPowerShell\Modules'),
        (Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules'),
        (Join-Path $PSHOME 'Modules')
    ) -join ';'
}

$Pasta = Join-Path $env:LOCALAPPDATA 'Komunick\SuperChatAlerta'
$Script = Join-Path $Pasta 'alerta-suporte.ps1'
$Atalho = Join-Path ([Environment]::GetFolderPath('Startup')) 'SuperChat - Alerta de chamados.lnk'
$AppIdChave = 'HKCU:\Software\Classes\AppUserModelId\Komunick.SuperChat.AlertaSuporte'
$PowerShell51 = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
# conhost --headless roda o PowerShell sem abrir janela nenhuma.
$Conhost = Join-Path $env:SystemRoot 'System32\conhost.exe'
$Argumentos = '--headless "{0}" -NoProfile -ExecutionPolicy Bypass -File "{1}"' -f $PowerShell51, $Script

function Stop-Alerta {
    Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine -like '*SuperChatAlerta\alerta-suporte.ps1*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

if ($Remover) {
    Stop-Alerta
    Remove-Item $Atalho -Force -ErrorAction SilentlyContinue
    Remove-Item $AppIdChave -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $Pasta -Recurse -Force -ErrorAction SilentlyContinue
    Write-Output 'Alerta de chamados removido.'
    return
}

if ($Url -notmatch '^https://[^\s/]+(/.*)?$' -and $Url -notmatch '^http://(127\.0\.0\.1|localhost)(:\d+)?(/.*)?$') {
    throw 'O endereco precisa comecar com https:// (http:// so para testes locais).'
}

New-Item -ItemType Directory -Path $Pasta -Force | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'alerta-suporte.ps1') $Script -Force

$ArquivoChave = Join-Path $Pasta 'chave.dat'
if ($Chave) {
    $segura = ConvertTo-SecureString $Chave.Trim() -AsPlainText -Force
} elseif (-not (Test-Path $ArquivoChave)) {
    $segura = Read-Host 'Cole a chave do alerta (sca_...)' -AsSecureString
} else {
    $segura = $null
}
if ($segura) {
    if ($segura.Length -ne 47) { throw 'Chave invalida: ela comeca com sca_ e tem 47 caracteres.' }
    # Cifrada pelo Windows para esta conta (DPAPI).
    ConvertFrom-SecureString $segura | Set-Content $ArquivoChave -Encoding ASCII
}

@{ url = $Url.TrimEnd('/'); intervalo = $Intervalo; relembrarMinutos = $RelembrarMinutos } |
    ConvertTo-Json | Set-Content (Join-Path $Pasta 'config.json') -Encoding UTF8
# Outro endereco e outra fila: o que ja foi avisado nao vale mais.
Remove-Item (Join-Path $Pasta 'vistos.json') -Force -ErrorAction SilentlyContinue

# Nome que aparece no aviso do Windows.
New-Item -Path $AppIdChave -Force | Out-Null
Set-ItemProperty -Path $AppIdChave -Name 'DisplayName' -Value 'SuperChat - Suporte'
Set-ItemProperty -Path $AppIdChave -Name 'ShowInSettings' -Value 1 -Type DWord

# Comeca junto com o Windows, pela pasta Inicializar do usuario.
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($Atalho)
$link.TargetPath = $Conhost
$link.Arguments = $Argumentos
$link.WorkingDirectory = $Pasta
$link.Description = 'Avisa e apita quando chega chamado de suporte no SuperChat'
$link.Save()

Stop-Alerta
if (-not $SemIniciar) {
    Start-Process -FilePath $Conhost -ArgumentList $Argumentos -WorkingDirectory $Pasta -WindowStyle Hidden
}

Write-Output ("Alerta de chamados instalado em {0}" -f $Pasta)
Write-Output ("Consulta {0} a cada {1} segundos e comeca junto com o Windows." -f $Url, $Intervalo)
Write-Output ('Teste o aviso e o apito: powershell -File "{0}" -Teste' -f $Script)
