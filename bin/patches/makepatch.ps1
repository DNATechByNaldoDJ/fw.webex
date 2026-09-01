# Le as extensoes do arquivo e remove linhas em branco
$extensions = Get-Content "ext.txt" | Where-Object { $_.Trim() -ne "" }
# Executa o Get-ChildItem com filtro por extensao, ignorando o diretorio __rpo-legacy-cleanup e .vscode
Get-ChildItem -Recurse ..\..\src\ -File | Where-Object {
    $extMatch = $false
    foreach ($pattern in $extensions) {
        if ($_.Name -like $pattern) {
            $extMatch = $true
            break
        }
    }
    $extMatch -and $_.FullName -notmatch '__rpo-legacy-cleanup'  -and $_.FullName -notmatch '.vscode'
} | % { if($_.Extension.Length -gt 0) {$_.Name+';'} } > .\makepatch.lst

$path = ".\makepatch.lst"
$Content = (Get-Content $path -Raw)
$Content.Replace(";","") | Set-Content ".\makepatch.txt" -Force
$Content.Replace("`r`n","") | Set-Content $path -Force
