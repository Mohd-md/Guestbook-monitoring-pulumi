# Kubernetes Guestbook Monitoring with Prometheus & Grafana

- Overview

This project extends the Pulumi Kubernetes Guestbook application by integrating monitoring using Prometheus and Grafana.

The monitoring stack allows observing application health and system-level metrics.

--------------------

# Architecture

- Guestbook Application (Frontend + Redis)
- Prometheus (metrics collection)
- Grafana (visualization)

---------------------

# Prerequisites

- Node.js
- Pulumi CLI
- Docker Desktop (enabled Kubernetes)
- kubectl configured

--------------------

# Deployment Steps

1. Clone Repository

bash:
**$ git clone <repo-url>
$ cd kubernetes-ts-guestbook/simple**

--------------------
2. Install Dependencies

bash:
**$ npm install**

--------------------

3. Deploy Infrastructure

bash:
**$ pulumi up**

--------------------
4. Verify Application

bash:
**$ kubectl get pods
$ kubectl get svc**

--------------------

# Monitoring Setup

1. Prometheus

- Deployed in "monitoring" namespace
- Scrapes:
"localhost:9090"
"Guestbook frontend service"

To Access:

bash:
**$ kubectl port-forward svc/prometheus -n monitoring 9090:9090**

Open in browser:

http://localhost:9090
--------------------

2. Grafana

To Access:

bash:
**$ kubectl port-forward svc/grafana -n monitoring 3000:3000**

Open in browser:

**$ http://localhost:3000**

Credentials:

Username: admin
Password: admin

--------------------

# Prometheus Configuration

Scrape config:

yaml:
-----
scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'frontend'
    static_configs:
      - targets: ['frontend.default.svc.cluster.local:80']

----------------------

# Grafana Dashboard

--> Grafana Credentials

**- Username: admin**
**- Password: admin**

Used below queries:

# For Health Check

promql:
-------
up
-------

# Memory Usage

promql:
-------
process_resident_memory_bytes
-------

# Request Rate

promql:
-------
rate(prometheus_http_requests_total[1m])
-------

----------------------


The Guestbook application does not expose Prometheus metrics (`/metrics` endpoint).

**- Prometheus successfully connects to the service**
**- But returns `404 Not Found` for metrics**

Where,
✔ Network connectivity is working
✔ Scraping configuration is correct

-----------------------

# Verification Steps

1. Open Prometheus:
   http://localhost:9090

2. Go to Status → Targets

3. Verify:
   - Prometheus target → UP
   - Frontend target → reachable (got 404)

4. Open Grafana:
   http://localhost:3000

5. Run queries:
   - up
   - process_resident_memory_bytes

-----------------------

# Conclusion

Monitoring stack successfully deployed using Pulumi:

- Prometheus collects metrics
- Grafana visualizes data
- Guestbook service integrated into monitoring pipeline

----------------------

# Submission

- Pulumi code included
- Monitoring configured
- Grafana dashboards created
- Deployment steps documented

----------------------

# Screenshots

1. Grafana Dashboard
![Grafana](imgs/grafana-dashboard.png)
![Grafana](imgs/grafana-dashboard2.png)

2. Prometheus Targets
![Prometheus](imgs/prometheus-targets.png)
![Prometheus](imgs/prometheus-service.png)

3. Kubernetes Pods
![Pods](imgs/pods-running.png)

4. Docker-desktop
![Docker](imgs/Docker-desktop-1.png)
![Docker](imgs/Docker-desktop-2.png)
