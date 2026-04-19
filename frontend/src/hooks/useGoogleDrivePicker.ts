import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface PickerConfig {
  clientId?: string;
  apiKey?: string;
  appId?: string;
  onFilePicked: (file: { id: string; name: string; url: string; mimeType: string }) => void;
  onCancel?: () => void;
}

export const useGoogleDrivePicker = () => {
  const [isScriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // If already loaded, ignore
    if ((window as any).gapi) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      (window as any).gapi.load("auth", { callback: () => setScriptLoaded(true) });
      (window as any).gapi.load("picker", { callback: () => {} });
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const openPicker = (config: PickerConfig) => {
    if (!isScriptLoaded || !(window as any).gapi) {
      toast.error("Google Drive API is loading, please try again in a moment.");
      return;
    }

    const clientId = config.clientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const apiKey = config.apiKey || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const appId = config.appId || process.env.NEXT_PUBLIC_GOOGLE_APP_ID;

    if (!clientId || !apiKey || !appId) {
      toast.error("Google Drive is not configured! Missing API keys.");
      return;
    }

    const gapi = (window as any).gapi;
    const google = (window as any).google;

    // Authenticate first
    gapi.auth.authorize(
      {
        client_id: clientId,
        scope: ["https://www.googleapis.com/auth/drive.readonly"],
        immediate: false,
      },
      (authResult: any) => {
        if (authResult && !authResult.error) {
          // Token is present, open Picker
          const view = new google.picker.View(google.picker.ViewId.DOCS);
          
          const picker = new google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(authResult.access_token)
            .setDeveloperKey(apiKey)
            .setAppId(appId)
            .setCallback((data: any) => {
              if (data.action === google.picker.Action.PICKED) {
                const doc = data.docs[0];
                config.onFilePicked({
                  id: doc.id,
                  name: doc.name,
                  url: doc.url,
                  mimeType: doc.mimeType,
                });
              } else if (data.action === google.picker.Action.CANCEL) {
                if (config.onCancel) config.onCancel();
              }
            })
            .build();
            
          picker.setVisible(true);
        } else {
          toast.error("Failed to authenticate with Google.");
        }
      }
    );
  };

  return { openPicker, isReady: isScriptLoaded };
};
