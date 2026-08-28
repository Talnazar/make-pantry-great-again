import { type FirebaseApp, initializeApp, getApps } from 'firebase/app'
import { type Auth, getAuth } from 'firebase/auth'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'

const firebaseConfig = {
  apiKey: 'AIzaSyBuK6nJU0Gio_4g7vAxuMar8c_IKRvcH5c',
  authDomain: 'pantry-doodoo.firebaseapp.com',
  projectId: 'pantry-doodoo',
  storageBucket: 'pantry-doodoo.firebasestorage.app',
  messagingSenderId: '828105082859',
  appId: '1:828105082859:web:e6186b7ebcb3e1c58ebbae',
}

let firebaseApp: FirebaseApp | undefined
let appCheckInitialized = false

const ensureApp = (): FirebaseApp => {
  if (!firebaseApp) {
    const existingApps = getApps()
    firebaseApp = existingApps[0] ?? initializeApp(firebaseConfig)
  }
  return firebaseApp
}

const ensureAppCheck = (app: FirebaseApp): void => {
  if (appCheckInitialized) return
  if (!import.meta.client) return

  const config = useRuntimeConfig()
  const siteKey = config.public.recaptchaSiteKey as string
  if (siteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
  }
  appCheckInitialized = true
}

export const getFirebaseAuth = (): Auth => {
  const app = ensureApp()
  ensureAppCheck(app)
  return getAuth(app)
}

export const useFirebase = () => {
  return {
    getFirebaseAuth,
  }
}
