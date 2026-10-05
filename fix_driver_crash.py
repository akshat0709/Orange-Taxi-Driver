with open('App.tsx', 'r') as f:
    app_code = f.read()

old_code = """          const declinesStr = await AsyncStorage.getItem("orange_declines");
          const declines = declinesStr ? JSON.parse(declinesStr) : {};"""

new_code = """          const declinesStr = await AsyncStorage.getItem("orange_declines");
          let declines = {};
          try {
            if (declinesStr) declines = JSON.parse(declinesStr);
          } catch(e) {}"""

app_code = app_code.replace(old_code, new_code)

with open('App.tsx', 'w') as f:
    f.write(app_code)

