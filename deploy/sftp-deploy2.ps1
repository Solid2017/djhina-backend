Import-Module Posh-SSH

$pass = ConvertTo-SecureString 'qspSvNVcgkJU93Q' -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ('igote2759178', $pass)
$sess = New-SFTPSession -ComputerName 'igotech.tech' -Credential $cred -AcceptKey -Force

$remote = '/htdocs/djhina.igotech.tech'
$local  = 'D:\APPS\DjhinaBackend'

# ── Créer un dossier distant (avec vérification correcte) ──────────────
function EnsureDir($path) {
    $exists = $false
    try {
        $null = Get-SFTPChildItem -SessionId $sess.SessionId -Path $path -ErrorAction Stop
        $exists = $true
    } catch {}

    if (-not $exists) {
        try {
            New-SFTPItem -SessionId $sess.SessionId -Path $path -ItemType Directory -ErrorAction Stop
            Write-Output "  cree: $path"
        } catch {
            Write-Output "  ERREUR creation $path : $($_.Exception.Message)"
        }
    } else {
        Write-Output "  existe: $path"
    }
}

# ── Uploader un fichier (destination = dossier distant) ────────────────
function UploadFile($localPath, $remoteDir) {
    try {
        Set-SFTPItem -SessionId $sess.SessionId -Path $localPath -Destination $remoteDir -Force -ErrorAction Stop
        $rel = $localPath.Replace("$local\", '')
        Write-Output "  [OK] $rel"
    } catch {
        $rel = $localPath.Replace("$local\", '')
        Write-Output "  [ERR] $rel : $($_.Exception.Message)"
    }
}

Write-Output ""
Write-Output "=== Creation des dossiers ==="
EnsureDir "$remote/src"
EnsureDir "$remote/src/config"
EnsureDir "$remote/src/controllers"
EnsureDir "$remote/src/middleware"
EnsureDir "$remote/src/routes"
EnsureDir "$remote/src/templates"
EnsureDir "$remote/database"
EnsureDir "$remote/public"
EnsureDir "$remote/public/admin"
EnsureDir "$remote/public/admin/css"
EnsureDir "$remote/public/admin/js"
EnsureDir "$remote/uploads"
EnsureDir "$remote/uploads/speakers"
EnsureDir "$remote/uploads/avatars"
EnsureDir "$remote/uploads/events"

Write-Output ""
Write-Output "=== Upload des fichiers ==="

# Fichiers racine
UploadFile "$local\server.js"         $remote
UploadFile "$local\package.json"      $remote
UploadFile "$local\package-lock.json" $remote
UploadFile "$local\.env"              $remote

# src/config
UploadFile "$local\src\config\database.js" "$remote/src/config"

# src/controllers
Get-ChildItem "$local\src\controllers" -Filter "*.js" | ForEach-Object {
    UploadFile $_.FullName "$remote/src/controllers"
}

# src/middleware
Get-ChildItem "$local\src\middleware" -Filter "*.js" | ForEach-Object {
    UploadFile $_.FullName "$remote/src/middleware"
}

# src/routes
Get-ChildItem "$local\src\routes" -Filter "*.js" | ForEach-Object {
    UploadFile $_.FullName "$remote/src/routes"
}

# src/templates
Get-ChildItem "$local\src\templates" -Filter "*.js" | ForEach-Object {
    UploadFile $_.FullName "$remote/src/templates"
}

# database
Get-ChildItem "$local\database" -Filter "*.js" | ForEach-Object {
    UploadFile $_.FullName "$remote/database"
}

# public/admin
if (Test-Path "$local\public\admin\index.html") {
    UploadFile "$local\public\admin\index.html" "$remote/public/admin"
    UploadFile "$local\public\admin\login.html" "$remote/public/admin"
}
Get-ChildItem "$local\public\admin\css" -Filter "*.css" -ErrorAction SilentlyContinue | ForEach-Object {
    UploadFile $_.FullName "$remote/public/admin/css"
}
Get-ChildItem "$local\public\admin\js" -Filter "*.js" -ErrorAction SilentlyContinue | ForEach-Object {
    UploadFile $_.FullName "$remote/public/admin/js"
}

Remove-SFTPSession -SessionId $sess.SessionId
Write-Output ""
Write-Output "=== UPLOAD TERMINE ==="
Write-Output "Fichiers deposes dans : $remote"
