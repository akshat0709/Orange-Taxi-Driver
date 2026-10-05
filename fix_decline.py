import re

with open('App.tsx', 'r') as f:
    app_code = f.read()

old_decline = """  const handleDeclineRide = async (booking: Booking) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    await soundService.stopDispatchAlert();
    setDeclinedBookingIds((prev) => [...prev, booking.id]);
    setIncomingBooking(null);
  };"""

new_decline = """  const handleDeclineRide = async (booking: Booking) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    await soundService.stopDispatchAlert();
    setDeclinedBookingIds((prev) => [...prev, booking.id]);
    
    try {
      const decsStr = await AsyncStorage.getItem("orange_declines");
      const decs = decsStr ? JSON.parse(decsStr) : {};
      const count = decs[booking.id]?.count || 0;
      decs[booking.id] = {
        count: count + 1,
        lastDeclinedAt: Date.now()
      };
      await AsyncStorage.setItem("orange_declines", JSON.stringify(decs));
    } catch(e) {}

    setIncomingBooking(null);
  };"""

app_code = app_code.replace(old_decline, new_decline)

with open('App.tsx', 'w') as f:
    f.write(app_code)

