import React, { useEffect, useRef } from "react";
import { loadGoogleMapScript } from "../../utils/loadGoogleMapScript";

const DEFAULT_POSITION = { lat: 12.9716, lng: 77.5946 }; 

const AddressMapAndZone = ({ lat, lng, onPinDragged }) => {
  const mapRef = useRef(null);

  useEffect(() => {
    let mapInstance = null;
  
    const initMap = async () => {
      try {
        const apiKey = import.meta.env.VITE_APP_MAP_API_KEY;
        await loadGoogleMapScript(apiKey);
  
        // Retry if mapRef.current is not ready yet
        if (!mapRef.current || !(mapRef.current instanceof HTMLElement)) {
          requestAnimationFrame(initMap); // Try again on the next frame
          return;
        }
  
        const position = {
          lat: lat ? parseFloat(lat) : DEFAULT_POSITION.lat,
          lng: lng ? parseFloat(lng) : DEFAULT_POSITION.lng,
        };
  
        const { Map, InfoWindow } = await window.google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary("marker");
  
        mapInstance = new Map(mapRef.current, {
          center: position,
          zoom: 15,
          mapId: "4504f8b37365c3d0",
        });
  
        const infoWindow = new InfoWindow();
        const marker = new AdvancedMarkerElement({
          map: mapInstance,
          position,
          gmpDraggable: true,
          title: "Drag me!",
        });
  
        marker.addListener("dragend", () => {
          const newPos = marker.position;
          infoWindow.setContent(
            `<div><b>Lat:</b> ${newPos.lat.toFixed(5)}<br/><b>Lng:</b> ${newPos.lng.toFixed(5)}</div>`
          );
          infoWindow.open(mapInstance, marker);
  
          onPinDragged?.({ lat: newPos.lat, lng: newPos.lng });
        });
      } catch (error) {
        console.error("Failed to initialize map:", error);
      }
    };
  
    requestAnimationFrame(initMap); 
  }, []);
  
  return <div ref={mapRef} className="w-full h-[40vh] rounded-lg shadow-md" />;
};

export default AddressMapAndZone;
