Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('c:\Users\sneha\Desktop\Project\Saathi-Care\public\images\DESIGN 1.png')
Write-Output "Width: $($img.Width), Height: $($img.Height)"
$img.Dispose()
