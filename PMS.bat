@echo off
cd /d "%~dp0"
title PMS
py -3 launcher.py 2>nul
if errorlevel 1 python launcher.py
if errorlevel 1 (
  echo Python is required. Install it from https://www.python.org/downloads/
  pause
)
