@echo off
echo ========================================
echo Deploying LexAI to Production
echo ========================================
echo.

echo [1/4] Deploying API to Cloudflare Workers...
cd apps\api
call wrangler deploy
if errorlevel 1 (
    echo ERROR: API deployment failed!
    cd ..\..
    pause
    exit /b 1
)
echo ✓ API deployed successfully
echo.

echo [2/4] Building frontend...
cd ..\web
call pnpm build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    cd ..\..
    pause
    exit /b 1
)
echo ✓ Frontend built successfully
echo.

echo [3/4] Deploying frontend to Cloudflare Pages...
call wrangler pages deploy dist --project-name=lexai
if errorlevel 1 (
    echo ERROR: Frontend deployment failed!
    cd ..\..
    pause
    exit /b 1
)
echo ✓ Frontend deployed successfully
echo.

cd ..\..

echo ========================================
echo ✓ Deployment Complete!
echo ========================================
echo.
echo API: https://lexai-api.jhaladik.workers.dev
echo Web: https://lexai.pages.dev
echo.
pause
