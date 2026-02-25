import React from "react";
import { View, Image, StyleSheet } from "react-native";

export default function TabWallpaper() {
  return (
    <View pointerEvents="none" style={styles.container}>
      <Image source={require("../../assets/wallpaper-logo.png")} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center"
  },
  logo: {
    width: 640,
    height: 640,
    opacity: 0.28
  }
});
