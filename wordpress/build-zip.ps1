# Builds the installable plugin zip.
#
# Not Compress-Archive. On Windows PowerShell it writes entry names with
# backslashes, and the ZIP spec (APPNOTE 4.4.17.1) requires forward
# slashes. PHP therefore reads the whole plugin as one flat file called
# "al-hadeed-hardware\al-hadeed-hardware.php" with no directory at all,
# and WordPress refuses the upload with:
#
#     Plugin file does not exist.
#
# So the entries are written by hand, with forward slashes, which is
# what every unzip on every platform expects.

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root 'al-hadeed-hardware'
$out  = Join-Path $root 'al-hadeed-hardware.zip'

if (-not (Test-Path $src)) { throw "No plugin folder at $src" }
if (Test-Path $out) { Remove-Item $out -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($out, 'Create')
try {
  $files = Get-ChildItem -Path $src -Recurse -File |
           Where-Object { $_.Name -ne '.DS_Store' -and $_.Extension -ne '.zip' }

  foreach ($f in $files) {
    # Path inside the zip: always "al-hadeed-hardware/..." with forward
    # slashes, whatever the host filesystem uses.
    $rel  = $f.FullName.Substring($src.Length).TrimStart('\', '/')
    $name = 'al-hadeed-hardware/' + ($rel -replace '\\', '/')

    $entry  = $zip.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)
    $target = $entry.Open()
    try {
      $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
      $target.Write($bytes, 0, $bytes.Length)
    } finally {
      $target.Dispose()
    }
  }
  "packed $($files.Count) files"
} finally {
  $zip.Dispose()
}

# Prove it: every entry must use forward slashes, and the plugin's main
# file must sit directly inside the folder.
$check = [System.IO.Compression.ZipFile]::OpenRead($out)
try {
  $names = $check.Entries | ForEach-Object { $_.FullName }
  $bad = $names | Where-Object { $_ -like '*\*' }
  if ($bad) { throw "Backslashes in: $($bad -join ', ')" }
  if ($names -notcontains 'al-hadeed-hardware/al-hadeed-hardware.php') {
    throw 'The plugin header file is not at al-hadeed-hardware/al-hadeed-hardware.php'
  }
  "ok - $($names.Count) entries, forward slashes, header file in place"
} finally {
  $check.Dispose()
}
