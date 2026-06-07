param(
  [Parameter(Mandatory = $true)][string]$ApiBaseUrl,
  [Parameter(Mandatory = $true)][string]$WebBaseUrl,
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password
)

$ErrorActionPreference = "Stop"

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body = $null,
    [hashtable]$Headers = @{}
  )

  $params = @{
    Method = $Method
    Uri = $Uri
    Headers = $Headers
    ContentType = "application/json"
  }

  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
  }

  return Invoke-RestMethod @params
}

Write-Host "1. API health"
$health = Invoke-Json -Method Get -Uri "$ApiBaseUrl/health"
if (-not $health.ok) { throw "API /health failed" }

Write-Host "2. API ready"
$ready = Invoke-Json -Method Get -Uri "$ApiBaseUrl/ready"
if (-not $ready.ok) { throw "API /ready failed" }

Write-Host "3. Login"
$login = Invoke-Json -Method Post -Uri "$ApiBaseUrl/auth/login" -Body @{
  email = $Email
  password = $Password
}

$token = $login.token
if (-not $token) { throw "Login did not return token" }

$headers = @{ Authorization = "Bearer $token" }

Write-Host "4. Shops"
$shops = Invoke-Json -Method Get -Uri "$ApiBaseUrl/shops" -Headers $headers
$shopId = $shops.shops[0].id
if (-not $shopId) { throw "No shop returned" }

Write-Host "5. Latest report"
$report = Invoke-Json -Method Get -Uri "$ApiBaseUrl/reports/$shopId/latest" -Headers $headers

Write-Host "6. Copilot chat"
$chat = Invoke-Json -Method Post -Uri "$ApiBaseUrl/copilot/chat" -Headers $headers -Body @{
  shopId = $shopId
  message = "Tai sao don giam?"
}
if (-not $chat.answer) { throw "Copilot chat returned no answer" }

Write-Host "7. Review draft dry-run"
$draft = Invoke-Json -Method Post -Uri "$ApiBaseUrl/ai/$shopId/review-reply-draft" -Headers $headers -Body @{
  tone = "professional"
}
if (-not $draft.feedback.id) { throw "Review draft did not return feedback" }

Write-Host "8. Web 200"
$web = Invoke-WebRequest -UseBasicParsing -Uri $WebBaseUrl
if ($web.StatusCode -ne 200) { throw "Web did not return 200" }

Write-Host ""
Write-Host "Staging smoke passed."
Write-Host "Shop: $shopId"
Write-Host "Health: $($health.ok)"
Write-Host "Ready: $($ready.ok)"
Write-Host "Copilot intent: $($chat.intent)"
