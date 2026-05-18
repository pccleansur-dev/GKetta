import http from "http";

export function restartSelf(): Promise<void> {
  const containerName = process.env.CONTAINER_NAME ?? "sistema-kettal-app";

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: "/var/run/docker.sock",
        path: `/containers/${containerName}/restart?t=2`,
        method: "POST",
      },
      (res) => {
        if (res.statusCode === 204) {
          resolve();
        } else {
          reject(new Error(`Docker daemon respondió con ${res.statusCode}`));
        }
      }
    );
    req.on("error", reject);
    req.end();
  });
}
