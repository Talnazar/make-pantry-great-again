import { initializeApp, getApps } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import type { User } from '~/types/state'

export default defineNuxtPlugin(() => {
  const firebaseConfig = {
    apiKey: 'AIzaSyBuK6nJU0Gio_4g7vAxuMar8c_IKRvcH5c',
    authDomain: 'pantry-doodoo.firebaseapp.com',
    projectId: 'pantry-doodoo',
    storageBucket: 'pantry-doodoo.firebasestorage.app',
    messagingSenderId: '828105082859',
    appId: '1:828105082859:web:e6186b7ebcb3e1c58ebbae',
  }

  if (!getApps().length) {
    const app = initializeApp(firebaseConfig)

    // App Check with ReCAPTCHA v3
    const recaptchaKey = useRuntimeConfig().public.recaptchaSiteKey as string
    if (recaptchaKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaKey),
        isTokenAutoRefreshEnabled: true,
      })
    }
  }

  // Keep auth store in sync with Firebase auth state (persists across reloads)
  const authStore = useAuthStore()
  const auth = getAuth()
  onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      const stateUser: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      }
      authStore.setUser(stateUser)
      try {
        localStorage.setItem(AUTHED_STORAGE_KEY, '1')
      } catch {
        // Ignore storage errors (private mode, disabled storage, etc.)
      }
    } else {
      authStore.setUser(null)
      try {
        localStorage.removeItem(AUTHED_STORAGE_KEY)
      } catch {
        // Ignore storage errors (private mode, disabled storage, etc.)
      }
    }
  })
})
