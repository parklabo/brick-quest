import { initializeApp } from 'firebase-admin/app';
import { config } from './config.js';

initializeApp({
  ...(config.firebase.storageBucket ? { storageBucket: config.firebase.storageBucket } : {}),
});

export { submitScan } from './callable/submitScan.js';
export { submitBuild } from './callable/submitBuild.js';
export { submitDesign } from './callable/submitDesign.js';
export { setAdminRole } from './callable/setAdminRole.js';
export { approveDesignViews } from './callable/approveDesignViews.js';
export { regenerateDesignViews } from './callable/regenerateDesignViews.js';
export { processJob, processDesignUpdate } from './triggers/processJob.js';
