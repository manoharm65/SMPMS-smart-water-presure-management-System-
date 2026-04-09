Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path 'SAMVED phase 2 Prototype Development Submission template.docx').Path)
$entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$content = $reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()
$matches = [regex]::Matches($content, '<w:t[^>]*>([^<]*)</w:t>')
($matches | ForEach-Object { $_.Groups[1].Value }) -join ' '
