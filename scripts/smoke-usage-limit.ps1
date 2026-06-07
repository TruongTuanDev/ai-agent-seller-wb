param(
  [string]$ApiBaseUrl = "http://localhost:4000",
  [string]$Email = "seller@wb-agent.local",
  [string]$Password = "Demo123456!",
  [string]$ShopId = "shop-seller-free-1",
  [int]$Attempts = 22
)

. "$PSScriptRoot/smoke-review-draft.ps1" -ApiBaseUrl $ApiBaseUrl -Email $Email -Password $Password -ShopId $ShopId -OnlyHelpers

$token = Get-LoginToken -ApiBaseUrl $ApiBaseUrl -Email $Email -Password $Password

for ($i = 1; $i -le $Attempts; $i++) {
  try {
    $result = Invoke-JsonApi -ApiBaseUrl $ApiBaseUrl -Method POST -Path "/ai/$ShopId/review-reply-draft" -Token $token -Body @{
      tone = "professional"
    }
    Write-Host "Attempt $i OK"
  } catch {
    Write-Host "Attempt $i FAILED -> $($_.Exception.Message)"
    break
  }
}
