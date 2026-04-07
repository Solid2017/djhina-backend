Import-Module Posh-SSH
$pass = ConvertTo-SecureString 'qspSvNVcgkJU93Q' -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ('igote2759178', $pass)
$sess = New-SFTPSession -ComputerName 'igotech.tech' -Credential $cred -AcceptKey -Force
Write-Output "Session ID: $($sess.SessionId)"
$items = Get-SFTPChildItem -SessionId $sess.SessionId -Path '/htdocs'
Write-Output "Contenu /htdocs:"
foreach ($i in $items) { Write-Output "  $($i.Name)  [dir=$($i.IsDirectory)]" }
Remove-SFTPSession -SessionId $sess.SessionId
Write-Output "Done"
