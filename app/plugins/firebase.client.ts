import { initializeApp, getApps } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const firebaseConfig = {
    apiKey: 'AIzaSyBuK6nJU0Gio_4g7vAxuMar8c_IKRvcH5c',
    authDomain: 'pantry-doodoo.firebaseapp.com',
    projectId: 'pantry-doodoo',
    storageBucket: 'pantry-doodoo.firebasestorage.app',
    messagingSenderId: '828105082859',
    appId: '1:828105082859:web:e6186b7ebcb3e1c58ebbae',
  }

  if (!getApps().length) {
    initializeApp(firebaseConfig)
  }

  if (config.public.useFirestoreEmulator) {
    connectFirestoreEmulator(
      getFirestore(),
      config.public.firestoreEmulatorHost,
      config.public.firestoreEmulatorPort,
    )
  }
})
