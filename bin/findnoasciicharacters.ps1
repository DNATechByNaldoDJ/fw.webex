param(
    [Parameter(Mandatory = $true)]
    [string] $File
)

function Find-NoASCIICharacters {

    param(
        [Parameter(Mandatory = $true)]
        [string] $File
    )

    $lineNumber = 0

    Get-Content $File | ForEach-Object {
        $lineNumber++
        if ($_ -cmatch '[^\x20-\x7F]') {
            [PSCustomObject]@{
                Line    = $lineNumber
                Content = $_
            }
        }
    }
}

Find-NoASCIICharacters $File
