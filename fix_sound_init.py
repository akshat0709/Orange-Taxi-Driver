with open('App.tsx', 'r') as f:
    app_code = f.read()

init_code = """  useEffect(() => {
    soundService.configureAudioMode();
  }, []);

  // Theme setup"""

app_code = app_code.replace("  // Theme setup", init_code)

with open('App.tsx', 'w') as f:
    f.write(app_code)
