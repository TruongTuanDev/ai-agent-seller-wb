param(
  [string]$ApiBaseUrl = "http://localhost:4000",
  [string]$Email = "demo@wb-agent.local",
  [string]$Password = "Demo123456!",
  [string]$ShopId = "shop-demo-1"
)

. "$PSScriptRoot/smoke-review-draft.ps1" -ApiBaseUrl $ApiBaseUrl -Email $Email -Password $Password -ShopId $ShopId -OnlyHelpers

$token = Get-LoginToken -ApiBaseUrl $ApiBaseUrl -Email $Email -Password $Password
Invoke-JsonApi -ApiBaseUrl $ApiBaseUrl -Method POST -Path "/ai/$ShopId/health-report" -Token $token | ConvertTo-Json -Depth 8
