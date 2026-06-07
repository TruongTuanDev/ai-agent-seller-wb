param(
  [string]$ApiBaseUrl = "http://localhost:4000",
  [string]$Email = "demo@wb-agent.local",
  [string]$Password = "Demo123456!",
  [string]$ShopId = "shop-demo-1",
  [switch]$OnlyHelpers
)

function Invoke-JsonApi {
  param(
    [string]$ApiBaseUrl,
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

  return Invoke-RestMethod @params
}

function Get-LoginToken {
  param(
    [string]$ApiBaseUrl,
    [string]$Email,
    [string]$Password
  )

  $login = Invoke-JsonApi -ApiBaseUrl $ApiBaseUrl -Method POST -Path "/auth/login" -Body @{
    email = $Email
    password = $Password
  }

  return [string]$login.token
}

if ($OnlyHelpers) {
  return
}

$token = Get-LoginToken -ApiBaseUrl $ApiBaseUrl -Email $Email -Password $Password
Invoke-JsonApi -ApiBaseUrl $ApiBaseUrl -Method POST -Path "/ai/$ShopId/review-reply-draft" -Token $token -Body @{
  tone = "professional"
} | ConvertTo-Json -Depth 8
