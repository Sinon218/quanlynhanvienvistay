let swRegistration = null;

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('Service Worker đã đăng ký thành công');
      return swRegistration;
    } catch (error) {
      console.error('Lỗi đăng ký Service Worker:', error);
      return null;
    }
  }
  console.warn('Trình duyệt không hỗ trợ Service Worker');
  return null;
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Trình duyệt không hỗ trợ Notifications');
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }
  return Notification.permission;
}

export async function subscribePush() {
  if (!swRegistration) {
    swRegistration = await registerServiceWorker();
  }
  if (!swRegistration) return null;

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.warn('Chưa cấp quyền thông báo');
    return null;
  }

  try {
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: null
    });
    console.log('Đăng ký Push thành công:', subscription);
    return subscription;
  } catch (error) {
    console.error('Lỗi đăng ký Push:', error);
    return null;
  }
}

export async function showLocalNotification(title, body) {
  if (!swRegistration) {
    swRegistration = await registerServiceWorker();
  }
  if (!swRegistration) return;

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.warn('Chưa cấp quyền thông báo');
    return;
  }

  swRegistration.showNotification(title, {
    body: body,
    icon: '/manifest.json',
    badge: '/manifest.json',
    vibrate: [200, 100, 200]
  });
}
