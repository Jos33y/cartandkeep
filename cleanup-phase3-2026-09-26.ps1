# Removes files nothing imports any more. Run from the repo root; it lists what it removed and what was already gone.
$files = @(
  'src/hooks/useSections.js',
  'src/components/ui/store/CategoryControls.jsx', 'src/styles/ui/store/category-controls.module.css',
  'src/components/ui/store/Cupboard.jsx', 'src/styles/ui/store/cupboard.module.css',
  'src/components/ui/store/DeliveryEstimate.jsx', 'src/styles/ui/store/delivery-estimate.module.css',
  'public/payment/Apple_Pay_logo.svg', 'public/payment/ma_symbol.svg', 'public/payment/mastercard-full-svgrepo-com.svg',
  'public/payment/stripe-svgrepo-com.svg', 'public/payment/visa-svgrepo-com.svg', 'public/payment/visa-svgrepo-com_2.svg'
)
foreach ($f in $files) {
  # Refuse if anything still imports it, so a delete can never break the build.
  $name = [System.IO.Path]::GetFileNameWithoutExtension($f)
  $users = Get-ChildItem -Path src -Recurse -Include *.js,*.jsx -File | Select-String -SimpleMatch "/$name'" | Where-Object { $_.Path -notlike "*$name*" }
  if ($users) { Write-Host "KEPT    $f  (still imported by $($users[0].Path))"; continue }
  if (Test-Path $f) { Remove-Item $f; Write-Host "removed $f" } else { Write-Host "gone    $f" }
}
