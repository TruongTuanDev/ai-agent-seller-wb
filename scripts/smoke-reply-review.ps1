param(
  [string]$ApiBaseUrl = "http://localhost:4000",
  [string]$Email = "demo@wb-agent.local",
  [string]$Password = "Demo123456!",
  [string]$ShopId = "shop-demo-1"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-JsonApi {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [string]$Token = ""
  )

  $headers = @{ "Content-Type" = "application/json" }
  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }

  $params = @{
    Method = $Method
    Uri = "$ApiBaseUrl$Path"
    Headers = $headers
  }

  if ($null -ne $Body) {
    $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
  }

  try {
    return Invoke-RestMethod @params
  } catch {
    $response = $_.Exception.Response
    if ($null -ne $response) {
      $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
      $raw = $reader.ReadToEnd()
      $reader.Close()
      throw "API $Method $Path failed: $raw"
    }

    throw
  }
}

Write-Host "Login demo account..."
$login = Invoke-JsonApi -Method POST -Path "/auth/login" -Body @{
  email = $Email
  password = $Password
}
$token = [string]$login.token

Write-Host "Load shop detail..."
$shop = Invoke-JsonApi -Method GET -Path "/shops/$ShopId" -Token $token

$feedback = $shop.shop.feedbacks | Where-Object { $_.status -eq "NEW" -or $_.status -eq "DRAFTED" } | Select-Object -First 1
if (-not $feedback) {
  throw "Khong tim thay feedback demo de smoke REPLY_REVIEW."
}

Write-Host "Create or refresh AI reply draft..."
$draft = Invoke-JsonApi -Method POST -Path "/ai/$ShopId/review-reply-draft" -Token $token -Body @{
  feedbackId = $feedback.id
  tone = "professional"
}
$actionId = [string]$draft.action.id

Write-Host "Case: execute before approve should fail..."
try {
  Invoke-JsonApi -Method POST -Path "/actions/$actionId/execute" -Token $token -Body @{
    confirmDangerous = $true
    confirmReplySend = $true
  } | Out-Null
  throw "Expected failure for unapproved action."
} catch {
  Write-Host "  OK -> unapproved action rejected"
}

Write-Host "Approve action..."
Invoke-JsonApi -Method POST -Path "/actions/$actionId/approve" -Token $token | Out-Null

Write-Host "Case: missing second confirmation should fail..."
try {
  Invoke-JsonApi -Method POST -Path "/actions/$actionId/execute" -Token $token -Body @{
    confirmDangerous = $true
    confirmReplySend = $false
  } | Out-Null
  throw "Expected failure for missing second confirmation."
} catch {
  Write-Host "  OK -> second confirmation required"
}

Write-Host "Recreate draft because failed action is terminal..."
$draft = Invoke-JsonApi -Method POST -Path "/ai/$ShopId/review-reply-draft" -Token $token -Body @{
  feedbackId = $feedback.id
  tone = "professional"
}
$actionId = [string]$draft.action.id
Invoke-JsonApi -Method POST -Path "/actions/$actionId/approve" -Token $token | Out-Null

Write-Host "Case: approved + confirmed execute..."
$execute = Invoke-JsonApi -Method POST -Path "/actions/$actionId/execute" -Token $token -Body @{
  confirmDangerous = $true
  confirmReplySend = $true
}
$execute | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "Manual real-mode cases still require env/token setup:"
Write-Host "- ENABLE_REAL_WB_API=true + WB_WRITE_DRY_RUN=true -> expect mode=dry_run"
Write-Host "- ENABLE_REAL_WB_API=true + WB_WRITE_DRY_RUN=false with missing token -> expect clear token error"
Write-Host "- ENABLE_REAL_WB_API=true + WB_WRITE_DRY_RUN=false with invalid token -> expect normalized WB auth error"
Write-Host "- feedback already SENT -> rerun execute on sent feedback should fail"
