# Start backend and frontend servers in parallel

Write-Host "Starting Voice Interview Platform..." -ForegroundColor Green
Write-Host ""

# Start backend
Write-Host "Starting backend on http://127.0.0.1:8000" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "uvicorn backend.main:app --reload"

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start frontend
Write-Host "Starting frontend on http://localhost:3000" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "cd .\frontend\voice-interviewer; npm run dev"

Write-Host ""
Write-Host "Both servers are running!" -ForegroundColor Green
Write-Host "Backend: http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
