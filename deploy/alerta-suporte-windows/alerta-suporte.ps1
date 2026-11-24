# Zap Komunick: alerta de chamados de suporte no Windows (docs/PRD.md, RF-030).
#
# Fica rodando escondido na sessao de quem atende os chamados. A cada intervalo
# pergunta ao SuperChat o que esta esperando na fila e, quando aparece um
# chamado novo ou uma mensagem nova de um solicitante, mostra um aviso do
# Windows e apita. Clicar no aviso abre a aba Suporte.
#
# Usa a chave do alerta, que so le essa lista: nao e login e nao guarda senha.
# Instale com instalar.ps1. Escrito para o Windows PowerShell 5.1; os textos
# fixos nao tem acento de proposito, porque o 5.1 le o arquivo sem BOM como ANSI.
[CmdletBinding()]
param(
    # Mostra um aviso de exemplo, apita e sai. Nao consulta o servidor.
    [switch]$Teste,
    # Consulta o servidor uma vez, avisa se houver novidade e sai.
    [switch]$UmaVez,
    # Diagnostico: registra no log o que avisaria, sem aviso na tela nem apito.
    [switch]$SemAviso,
    # Pasta com chave.dat, config.json, vistos.json e alerta.log.
    [string]$Pasta = (Join-Path $env:LOCALAPPDATA 'Komunick\SuperChatAlerta')
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
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$AppId = 'Komunick.SuperChat.AlertaSuporte'
$AppIdReserva = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
$ArquivoChave = Join-Path $Pasta 'chave.dat'
$ArquivoConfig = Join-Path $Pasta 'config.json'
$ArquivoVistos = Join-Path $Pasta 'vistos.json'
$ArquivoLog = Join-Path $Pasta 'alerta.log'

function Write-Registro([string]$Texto) {
    try {
        if ((Test-Path $ArquivoLog) -and ((Get-Item $ArquivoLog).Length -gt 200KB)) {
            Get-Content $ArquivoLog -Tail 200 | Set-Content $ArquivoLog -Encoding UTF8
        }
        Add-Content -Path $ArquivoLog -Encoding UTF8 -Value ('{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $Texto)
    } catch {
        # Sem log o alerta continua valendo.
    }
}

function Read-Config {
    $config = @{ url = 'https://superchat.komunick.com'; intervalo = 30; relembrarMinutos = 0 }
    if (Test-Path $ArquivoConfig) {
        $lido = Get-Content $ArquivoConfig -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($nome in @('url', 'intervalo', 'relembrarMinutos')) {
            if ($null -ne $lido.PSObject.Properties[$nome]) { $config[$nome] = $lido.$nome }
        }
    }
    $config.url = ([string]$config.url).TrimEnd('/')
    $config.intervalo = [Math]::Max(10, [int]$config.intervalo)
    $config.relembrarMinutos = [Math]::Max(0, [int]$config.relembrarMinutos)
    return $config
}

# A chave fica cifrada pelo Windows para este usuario (DPAPI): copiar o
# arquivo para outra conta ou outro computador nao serve.
function Read-Chave {
    if (-not (Test-Path $ArquivoChave)) { throw 'Chave do alerta nao configurada. Rode instalar.ps1.' }
    $segura = (Get-Content $ArquivoChave -Raw).Trim() | ConvertTo-SecureString
    $ponteiro = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ponteiro) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ponteiro) }
}

function Invoke-Apito {
    try {
        [Console]::Beep(880, 180); [Console]::Beep(1175, 180); [Console]::Beep(1568, 320)
    } catch {
        try { [System.Media.SystemSounds]::Exclamation.Play() } catch { }
    }
}

function Show-Aviso([string]$Titulo, [string[]]$Linhas, [string]$Link) {
    if ($SemAviso) {
        Write-Registro ("(sem aviso) {0} | {1} | {2}" -f $Titulo, ($Linhas -join ' / '), $Link)
        return $false
    }
    $escapar = { param($texto) [Security.SecurityElement]::Escape([string]$texto) }
    $textos = ($Linhas | Select-Object -First 3 | ForEach-Object { '<text>' + (& $escapar $_) + '</text>' }) -join ''
    $destino = & $escapar $Link
    $xml = @"
<toast activationType="protocol" launch="$destino" scenario="reminder">
  <visual><binding template="ToastGeneric"><text>$(& $escapar $Titulo)</text>$textos</binding></visual>
  <actions>
    <action content="Abrir chamados" activationType="protocol" arguments="$destino"/>
    <action content="Dispensar" activationType="system" arguments="dismiss"/>
  </actions>
  <audio src="ms-winsoundevent:Notification.Reminder"/>
</toast>
"@
    $mostrado = $false
    try {
        [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
        [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
        $documento = New-Object Windows.Data.Xml.Dom.XmlDocument
        $documento.LoadXml($xml)
        foreach ($id in @($AppId, $AppIdReserva)) {
            try {
                $aviso = New-Object Windows.UI.Notifications.ToastNotification $documento
                [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($id).Show($aviso)
                $mostrado = $true
                break
            } catch {
                Write-Registro ("aviso recusado para {0}: {1}" -f $id, $_.Exception.Message)
            }
        }
    } catch {
        Write-Registro ("aviso do Windows indisponivel: {0}" -f $_.Exception.Message)
    }
    # O apito nao depende do aviso: toca mesmo com as notificacoes desligadas.
    Invoke-Apito
    return $mostrado
}

function Get-Fila($Config, [string]$Chave) {
    return Invoke-RestMethod -Method Get -Uri ($Config.url + '/backend/support/alerts') `
        -Headers @{ Authorization = 'Bearer ' + $Chave } -TimeoutSec 20 -UseBasicParsing
}

function Read-Vistos {
    if (-not (Test-Path $ArquivoVistos)) { return @() }
    try {
        # No PowerShell 5.1 o ConvertFrom-Json entrega a lista como um objeto
        # so; passar pela variavel e o que separa os itens.
        $lido = Get-Content $ArquivoVistos -Raw -Encoding UTF8 | ConvertFrom-Json
        return @($lido | ForEach-Object { [string]$_ })
    } catch { return @() }
}

function Format-Chamado($Chamado) {
    $partes = @($Chamado.title, $Chamado.companyName, $Chamado.userName) | Where-Object { $_ }
    $urgente = ''
    if ($Chamado.priority -eq 'critical') { $urgente = ' [CRITICA]' }
    return ('{0}{1} - {2}' -f $Chamado.number, $urgente, (@($partes) -join ' - '))
}

# Uma rodada: devolve quantos chamados com novidade foram avisados.
function Invoke-Rodada($Config, [string]$Chave, [ref]$UltimoLembrete) {
    $fila = Get-Fila $Config $Chave
    $chamados = @($fila.tickets)
    $vistos = @(Read-Vistos)
    # Cada novidade e um par chamado + momento: mensagem nova no mesmo chamado
    # tem outro momento e avisa de novo.
    $atuais = @($chamados | ForEach-Object { '{0}|{1}' -f $_.id, $_.at })
    $novos = @($chamados | Where-Object { $vistos -notcontains ('{0}|{1}' -f $_.id, $_.at) })
    $link = $Config.url + '/support'

    if ($novos.Count -gt 0) {
        $primeiro = $novos[0]
        if ($novos.Count -eq 1) {
            $titulo = 'Nova mensagem em chamado de suporte'
            if ($primeiro.kind -eq 'new') { $titulo = 'Novo chamado de suporte' }
            $link = '{0}/support/{1}' -f $Config.url, $primeiro.id
        } else {
            $titulo = '{0} chamados de suporte com novidade' -f $novos.Count
        }
        [void](Show-Aviso $titulo @($novos | ForEach-Object { Format-Chamado $_ }) $link)
        Write-Registro ("avisado: {0}" -f (($novos | ForEach-Object { $_.number }) -join ', '))
        $UltimoLembrete.Value = Get-Date
    } elseif ($Config.relembrarMinutos -gt 0 -and $fila.unread -gt 0 -and
        ((Get-Date) - $UltimoLembrete.Value).TotalMinutes -ge $Config.relembrarMinutos) {
        [void](Show-Aviso ('{0} chamado(s) de suporte aguardando' -f $fila.unread) `
            @($chamados | ForEach-Object { Format-Chamado $_ }) $link)
        Write-Registro ("lembrete: {0} aguardando" -f $fila.unread)
        $UltimoLembrete.Value = Get-Date
    }

    ConvertTo-Json -InputObject $atuais -Compress | Set-Content $ArquivoVistos -Encoding UTF8
    return $novos.Count
}

# ---------------------------------------------------------------------------

if (-not (Test-Path $Pasta)) { New-Item -ItemType Directory -Path $Pasta -Force | Out-Null }
$config = Read-Config

if ($Teste) {
    [void](Show-Aviso 'Novo chamado de suporte' @('CH-000000 - Este e um aviso de teste do SuperChat', 'Quando chegar um chamado de verdade, ele aparece assim.') ($config.url + '/support'))
    return
}

$chave = Read-Chave
$ultimoLembrete = Get-Date

if ($UmaVez) {
    $avisados = Invoke-Rodada $config $chave ([ref]$ultimoLembrete)
    Write-Output ("novidades avisadas: {0}" -f $avisados)
    return
}

# Uma copia so por sessao: a segunda sai sem fazer nada.
$criado = $false
$trava = [Threading.Mutex]::new($true, 'Local\KomunickSuperChatAlertaSuporte', [ref]$criado)
if (-not $criado) { return }

Write-Registro ("iniciado: {0}, a cada {1}s" -f $config.url, $config.intervalo)
$falhaAvisada = $false
try {
    while ($true) {
        try {
            [void](Invoke-Rodada $config $chave ([ref]$ultimoLembrete))
            if ($falhaAvisada) { Write-Registro 'conexao normalizada'; $falhaAvisada = $false }
        } catch {
            $status = $null
            if ($_.Exception.PSObject.Properties['Response'] -and $_.Exception.Response) {
                $status = [int]$_.Exception.Response.StatusCode
            }
            if (-not $falhaAvisada) {
                Write-Registro ("falha ao consultar ({0}): {1}" -f $status, $_.Exception.Message)
                # Chave recusada nao se resolve sozinha: avisa uma vez. Queda
                # de rede so vai para o log e a consulta segue tentando.
                if ($status -eq 401) {
                    [void](Show-Aviso 'Alerta de chamados parado' @('O SuperChat recusou a chave do alerta.', 'Gere uma chave nova e rode instalar.ps1 de novo.') ($config.url + '/support'))
                }
                $falhaAvisada = $true
            }
        }
        Start-Sleep -Seconds $config.intervalo
    }
} finally {
    $trava.ReleaseMutex()
    $trava.Dispose()
}
