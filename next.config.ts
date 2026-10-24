import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Send title, description and canonical in <head> for every visitor and crawler (the public pages wait for the restaurant lookup anyway).
  htmlLimitedBots: /.*/,
  async headers() {
    return [{ source: "/(.*)", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] }];
  },
};

export default nextConfig;
