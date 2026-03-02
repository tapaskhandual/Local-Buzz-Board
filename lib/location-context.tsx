import React, { createContext, useContext, useState, useEffect } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";

interface LocationContextType {
  location: { latitude: number; longitude: number } | null;
  errorMsg: string | null;
  permissionStatus: Location.PermissionStatus | null;
  requestPermission: () => Promise<void>;
  refreshLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType>({
  location: null,
  errorMsg: null,
  permissionStatus: null,
  requestPermission: async () => {},
  refreshLocation: async () => {},
});

export function useLocation() {
  return useContext(LocationContext);
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);

  useEffect(() => {
    checkPermissionAndGetLocation();
  }, []);

  async function checkPermissionAndGetLocation() {
    try {
      if (Platform.OS === "web") {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              setPermissionStatus(Location.PermissionStatus.GRANTED);
            },
            () => {
              setErrorMsg("Location access denied");
              setPermissionStatus(Location.PermissionStatus.DENIED);
            }
          );
        }
        return;
      }
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status);
      if (status === Location.PermissionStatus.GRANTED) {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  }

  async function requestPermission() {
    try {
      if (Platform.OS === "web") {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              setPermissionStatus(Location.PermissionStatus.GRANTED);
              setErrorMsg(null);
            },
            () => {
              setErrorMsg("Location access denied");
              setPermissionStatus(Location.PermissionStatus.DENIED);
            }
          );
        }
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      if (status === Location.PermissionStatus.GRANTED) {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        setErrorMsg(null);
      } else {
        setErrorMsg("Location permission denied");
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  }

  async function refreshLocation() {
    try {
      if (Platform.OS === "web") {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            },
            () => {}
          );
        }
        return;
      }
      if (permissionStatus === Location.PermissionStatus.GRANTED) {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    } catch (e: any) {
      console.error("Refresh location error:", e);
    }
  }

  return (
    <LocationContext.Provider value={{ location, errorMsg, permissionStatus, requestPermission, refreshLocation }}>
      {children}
    </LocationContext.Provider>
  );
}
