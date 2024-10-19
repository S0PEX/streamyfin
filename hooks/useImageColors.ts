import { apiAtom } from "@/providers/JellyfinProvider";
import {
  adjustToNearBlack,
  calculateTextColor,
  isCloseToBlack,
  itemThemeColorAtom,
} from "@/utils/atoms/primaryColor";
import { getItemImage } from "@/utils/getItemImage";
import { storage } from "@/utils/mmkv";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";
import { getColors } from "react-native-image-colors";

/**
 * Custom hook to extract and manage image colors for a given item.
 *
 * @param item - The BaseItemDto object representing the item.
 * @param disabled - A boolean flag to disable color extraction.
 *
 */
export const useImageColors = ({
  item,
  url,
  disabled,
}: {
  item?: BaseItemDto | null;
  url?: string | null;
  disabled?: boolean;
}) => {
  const api = useAtomValue(apiAtom);
  const [, setPrimaryColor] = useAtom(itemThemeColorAtom);

  const source = useMemo(() => {
    if (!api) return;
    if (url) return { uri: url };
    else if (item)
      return getItemImage({
        item,
        api,
        variant: "Primary",
        quality: 80,
        width: 300,
      });
    else return null;
  }, [api, item]);

  useEffect(() => {
    if (disabled) return;
    if (source?.uri) {
      // Check if colors are already cached in storage
      const _primary = storage.getString(`${source.uri}-primary`);
      const _text = storage.getString(`${source.uri}-text`);

      // If colors are cached, use them and exit
      if (_primary && _text) {
        setPrimaryColor({
          primary: _primary,
          text: _text,
        });
        return;
      }

      // Extract colors from the image
      getColors(source.uri, {
        fallback: "#fff",
        cache: false,
      })
        .then((colors) => {
          let primary: string = "#fff";
          let text: string = "#000";
          let backup: string = "#fff";

          // Select the appropriate color based on the platform
          if (colors.platform === "android") {
            primary = colors.dominant;
            backup = colors.vibrant;
          } else if (colors.platform === "ios") {
            primary = colors.detail;
            backup = colors.primary;
          }

          // Adjust the primary color if it's too close to black
          if (primary && isCloseToBlack(primary)) {
            if (backup && !isCloseToBlack(backup)) primary = backup;
            primary = adjustToNearBlack(primary);
          }

          // Calculate the text color based on the primary color
          if (primary) text = calculateTextColor(primary);

          setPrimaryColor({
            primary,
            text,
          });

          // Cache the colors in storage
          if (source.uri && primary) {
            storage.set(`${source.uri}-primary`, primary);
            storage.set(`${source.uri}-text`, text);
          }
        })
        .catch((error) => {
          console.error("Error getting colors", error);
        });
    }
  }, [source?.uri, setPrimaryColor, disabled]);
};
