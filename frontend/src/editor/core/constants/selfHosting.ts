import { DOWNLOAD_URLS } from "@app/constants/downloads";

export type DockerImageTag = "latest" | "latest-fat" | "latest-ultra-lite";

const DOCKER_IMAGE = "ilikepdf/ilikepdf";

export const dockerRunCommand = (tag: DockerImageTag = "latest") =>
  `docker run -d --name ilikepdf -p 8080:8080 \\\n  -v ./ilikepdf-data:/configs \\\n  ${DOCKER_IMAGE}:${tag}`;

export const DOCKER_COMPOSE_FILE = `# Save as docker-compose.yml, then run: docker compose up -d
services:
  ilikepdf:
    image: ${DOCKER_IMAGE}:latest
    ports:
      - "8080:8080"
    volumes:
      - ./ilikepdf-data:/configs
    restart: unless-stopped`;

export const HELM_INSTALL_COMMAND = `helm repo add ilikepdf https://charts.example.com/ilikepdf
helm repo update
helm install ilikepdf ilikepdf/ilikepdf-chart \\\n  --namespace ilikepdf --create-namespace`;

export const SERVER_JAR_URL =
  "/downloads/iLikePdf-with-login.jar";

export const JAR_RUN_COMMAND =
  "java -Xmx2g -jar iLikePdf-with-login.jar\n# then open http://localhost:8080";

export const SELF_HOST_GUIDES = {
  docker: "https://docs.stirlingpdf.com/Installation/Docker%20Install/",
  kubernetes: "https://docs.stirlingpdf.com/Installation/Kubernetes%20Install/",
  manual: DOWNLOAD_URLS.LINUX_DOCS,
} as const;
