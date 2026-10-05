import React, { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { debounce } from "lodash";

const TextAddressField = ({ value = "", valueChange, name }) => {
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState([]);

  const MAP_API_KEY = import.meta.env.VITE_APP_MAP_API_KEY;

  const fetchSuggestions = async (inputVal) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        inputVal
      )}&components=country:gb&key=${MAP_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK") {
        setSuggestions(data.predictions);
      } else {
        setSuggestions([]);
        console.warn("Places API error:", data.status, data.error_message);
      }
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      setSuggestions([]);
    }
  };

  const debouncedFetch = debounce((val) => {
    if (val.length > 2) {
      fetchSuggestions(val);
    } else {
      setSuggestions([]);
    }
  }, 300);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    valueChange(val, name);
    debouncedFetch(val);
  };

  const handleSuggestionClick = async (suggestion) => {
    try {
      setInput(suggestion.description);
      setSuggestions([]);

      const detailsRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${suggestion.place_id}&key=${MAP_API_KEY}`
      );
      const detailsData = await detailsRes.json();

      if (detailsData.status !== "OK") {
        throw new Error("Failed to fetch place details");
      }

      const result = detailsData.result;
      const components = result.address_components;

      const getComponent = (type) =>
        components.find((comp) => comp.types.includes(type))?.long_name || "";

      const structured = {
        address: getComponent("street_number") + " " + getComponent("route"),
        city: getComponent("postal_town") || getComponent("locality"),
        county: getComponent("administrative_area_level_2") || getComponent("administrative_area_level_1"),
        // state: getComponent("administrative_area_level_1"),
        country: getComponent("country"),
        postalCode: getComponent("postal_code"),
        lat: result.geometry?.location?.lat || null,
        lng: result.geometry?.location?.lng || null,
      };

      valueChange(suggestion.description, name, structured);
    } catch (error) {
      console.error("Error fetching place details:", error);
    }
  };

  useEffect(() => {
    return () => debouncedFetch.cancel();
  }, []);

  return (
    <div className="relative w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
            Search Address
        </label>
      <input
        value={input}
        onChange={handleInputChange}
        placeholder="Search UK address"
        className="w-full border px-3 py-3  text-sm poppins-medium rounded"
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-10 bg-white border mt-1 w-full max-h-64 overflow-auto rounded shadow-md">
          {suggestions.map((s) => (
            <li
              key={s.place_id}
              onClick={() => handleSuggestionClick(s)}
              className="flex items-start px-4 py-2 gap-2 hover:bg-gray-100 cursor-pointer"
            >
              <MapPin size={18} className="mt-1 text-gray-600" />
              <span className="text-sm text-gray-800">{s.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TextAddressField;
