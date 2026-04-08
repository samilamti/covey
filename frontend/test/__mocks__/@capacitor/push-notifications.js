export const PushNotifications = {
  requestPermissions: async () => ({ receive: 'granted' }),
  register: async () => {},
  addListener: () => ({ remove: () => {} }),
}
