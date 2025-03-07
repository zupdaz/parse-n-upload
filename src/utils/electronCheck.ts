
import { toast } from "sonner";

export const checkElectronEnvironment = (): boolean => {
  const hasElectron = !!window.electron;
  
  if (!hasElectron) {
    console.warn("Running outside of Electron environment");
    toast.info("Limited functionality", {
      description: "Some features like particle size file parsing require the desktop application",
      duration: 5000,
    });
  } else {
    console.log("Electron environment detected");
  }
  
  return hasElectron;
};
