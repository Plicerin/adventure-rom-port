# Assembles adventure.asm with DASM and checks the result against the
# cartridge's MD5. Output: tools/build/adventure.{bin,lst,sym} (git-ignored),
# and rom/adventure.a26 for the oracle. Needs DASM 2.20.17 in tools/dasm.
# The disassembly defines its own TIA constants, so no vcs.h is needed.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Force $out | Out-Null

# DASM runs in a temp folder because Windows' Controlled Folder Access stops
# it writing under Documents; the results are copied back afterwards
$tmp = Join-Path ([IO.Path]::GetTempPath()) 'adventure-rom-build'
New-Item -ItemType Directory -Force $tmp | Out-Null
Copy-Item (Join-Path $root 'adventure.asm') $tmp -Force

Push-Location $tmp
try {
  # passed as an array: PowerShell mangles some DASM flags written inline
  $dasmArgs = @('adventure.asm', '-f3', '-oadventure.bin', '-ladventure.lst', '-sadventure.sym')
  & (Join-Path $PSScriptRoot 'dasm\dasm.exe') @dasmArgs
  if ($LASTEXITCODE -ne 0) { throw "DASM failed ($LASTEXITCODE)" }
} finally { Pop-Location }
Copy-Item (Join-Path $tmp 'adventure.*') $out -Force -Exclude 'adventure.asm'

$md5 = (Get-FileHash (Join-Path $out 'adventure.bin') -Algorithm MD5).Hash.ToLower()
if ($md5 -ne '157bddb7192754a45372be196797f284') { throw "assembled ROM MD5 $md5 does not match the cartridge" }
New-Item -ItemType Directory -Force (Join-Path $root 'rom') | Out-Null
Copy-Item (Join-Path $out 'adventure.bin') (Join-Path $root 'rom\adventure.a26') -Force
"OK: tools/build/adventure.bin matches the cartridge ($md5)"
