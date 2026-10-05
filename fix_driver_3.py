import re

with open('App.tsx', 'r') as f:
    app_code = f.read()

old1 = r"""            if \(driver.current_lat && driver.current_lng && candidate.pickup_lat && candidate.pickup_lng\) \{
              const d = getDistanceInKm\(driver.current_lat, driver.current_lng, candidate.pickup_lat, candidate.pickup_lng\);
              if \(d > 5\) continue;
            \}"""

new1 = r"""            const [pLat, pLng] = candidate.pickup_address ? candidate.pickup_address.split(',').map(Number) : [null, null];
            if (driver.current_lat && driver.current_lng && pLat && pLng) {
              const d = getDistanceInKm(driver.current_lat, driver.current_lng, pLat, pLng);
              if (d > 5) continue;
            }"""

old2 = r"""            if \(driver.current_lat && driver.current_lng && newBooking.pickup_lat && newBooking.pickup_lng\) \{
              const d = getDistanceInKm\(driver.current_lat, driver.current_lng, newBooking.pickup_lat, newBooking.pickup_lng\);
              if \(d > 5\) skip = true;
            \}"""

new2 = r"""            const [nLat, nLng] = newBooking.pickup_address ? newBooking.pickup_address.split(',').map(Number) : [null, null];
            if (driver.current_lat && driver.current_lng && nLat && nLng) {
              const d = getDistanceInKm(driver.current_lat, driver.current_lng, nLat, nLng);
              if (d > 5) skip = true;
            }"""

app_code = re.sub(old1, new1, app_code)
app_code = re.sub(old2, new2, app_code)

with open('App.tsx', 'w') as f:
    f.write(app_code)

