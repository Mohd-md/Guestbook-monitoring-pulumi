// Copyright 2016-2025, Pulumi Corporation.  All rights reserved.

import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

// Minikube does not implement services of type `LoadBalancer`; require the user to specify if we're
// running on minikube, and if so, create only services of type ClusterIP.
const config = new pulumi.Config();
const isMinikube = config.getBoolean("isMinikube");

//
// REDIS LEADER.
//

const redisLeaderLabels = { app: "redis-leader" };
const redisLeaderDeployment = new k8s.apps.v1.Deployment("redis-leader", {
    spec: {
        selector: { matchLabels: redisLeaderLabels },
        template: {
            metadata: { labels: redisLeaderLabels },
            spec: {
                containers: [
                    {
                        name: "redis-leader",
                        image: "redis",
                        resources: { requests: { cpu: "100m", memory: "100Mi" } },
                        ports: [{ containerPort: 6379 }],
                    },
                ],
            },
        },
    },
});
const redisLeaderService = new k8s.core.v1.Service("redis-leader", {
    metadata: {
        name: "redis-leader",
        labels: redisLeaderDeployment.metadata.labels,
    },
    spec: {
        ports: [{ port: 6379, targetPort: 6379 }],
        selector: redisLeaderDeployment.spec.template.metadata.labels,
    },
});

//
// REDIS REPLICA.
//

const redisReplicaLabels = { app: "redis-replica" };
const redisReplicaDeployment = new k8s.apps.v1.Deployment("redis-replica", {
    spec: {
        selector: { matchLabels: redisReplicaLabels },
        template: {
            metadata: { labels: redisReplicaLabels },
            spec: {
                containers: [
                    {
                        name: "replica",
                        image: "pulumi/guestbook-redis-replica",
                        resources: { requests: { cpu: "100m", memory: "100Mi" } },
                        // If your cluster config does not include a dns service, then to instead access an environment
                        // variable to find the leader's host, change `value: "dns"` to read `value: "env"`.
                        env: [{ name: "GET_HOSTS_FROM", value: "dns" }],
                        ports: [{ containerPort: 6379 }],
                    },
                ],
            },
        },
    },
});
const redisReplicaService = new k8s.core.v1.Service("redis-replica", {
    metadata: {
        name: "redis-replica",
        labels: redisReplicaDeployment.metadata.labels
    },
    spec: {
        ports: [{ port: 6379, targetPort: 6379 }],
        selector: redisReplicaDeployment.spec.template.metadata.labels,
    },
});

//
// FRONTEND
//

const frontendLabels = { app: "frontend" };
const frontendDeployment = new k8s.apps.v1.Deployment("frontend", {
    spec: {
        selector: { matchLabels: frontendLabels },
        replicas: 3,
        template: {
            metadata: { labels: frontendLabels },
            spec: {
                containers: [
                    {
                        name: "frontend",
                        image: "pulumi/guestbook-php-redis",
                        resources: { requests: { cpu: "100m", memory: "100Mi" } },
                        // If your cluster config does not include a dns service, then to instead access an environment
                        // variable to find the master service's host, change `value: "dns"` to read `value: "env"`.
                        env: [{ name: "GET_HOSTS_FROM", value: "dns" /* value: "env"*/ }],
                        ports: [{ containerPort: 80 }],
                    },
                ],
            },
        },
    },
});
const frontendService = new k8s.core.v1.Service("frontend", {
    metadata: {
    labels: frontendDeployment.metadata.labels,
    name: "frontend",
    annotations: {
        "prometheus.io/scrape": "true",
        "prometheus.io/port": "80",
        "prometheus.io/path": "/",
    },
},	
    spec: {
        type: isMinikube ? "ClusterIP" : "LoadBalancer",
        ports: [{ port: 80 }],
        selector: frontendDeployment.spec.template.metadata.labels,
    },
});

// Export the frontend IP.
export let frontendIp: pulumi.Output<string>;
if (isMinikube) {
    frontendIp = frontendService.spec.clusterIP;
} else {
    frontendIp = frontendService.status.loadBalancer.ingress[0].ip;
}

// ---------------- MONITORING ----------------


// Namespace
const monitoringNs = new k8s.core.v1.Namespace("monitoring", {
    metadata: { name: "monitoring" },
});

// Prometheus ConfigMap
const prometheusConfig = new k8s.core.v1.ConfigMap("prometheus-config", {
    metadata: { 
    	name: "prometheus-config",
	namespace: monitoringNs.metadata.name 
    },
    data: {
        "prometheus.yml": `
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'frontend'
    static_configs:
      - targets: ['frontend.default.svc.cluster.local:80']
    metrics_path: /
`,
    },
});

// Prometheus Deployment
const prometheus = new k8s.apps.v1.Deployment("prometheus", {
    metadata: { namespace: monitoringNs.metadata.name },
    spec: {
        selector: { matchLabels: { app: "prometheus" } },
        replicas: 1,
        template: {
            metadata: { labels: { app: "prometheus" } },
            spec: {
                   containers: [{
    		    name: "prometheus",
    		    image: "prom/prometheus",
    		    ports: [{ containerPort: 9090 }],
    	            args: [
        		"--config.file=/etc/prometheus/prometheus.yml"
    ],
    		   volumeMounts: [{
                       name: "config",
                       mountPath: "/etc/prometheus"
    }]
}],
		   volumes: [{
    		       name: "config",
    		       configMap: {
        	       	   name: "prometheus-config"
    }
}]
            },
        },
    },
}, { dependsOn: [prometheusConfig] });

// Prometheus Service
const prometheusService = new k8s.core.v1.Service("prometheus", {
    metadata: { namespace: monitoringNs.metadata.name },
    spec: {
        type: "NodePort",
        selector: { app: "prometheus" },
        ports: [{ port: 9090, targetPort: 9090 }],
    },
});

// Grafana Deployment
const grafana = new k8s.apps.v1.Deployment("grafana", {
    metadata: { namespace: monitoringNs.metadata.name },
    spec: {
        selector: { matchLabels: { app: "grafana" } },
        replicas: 1,
        template: {
            metadata: { labels: { app: "grafana" } },
            spec: {
                containers: [{
                    name: "grafana",
                    image: "grafana/grafana",
                    ports: [{ containerPort: 3000 }],
		    env: [
        		{ name: "GF_SECURITY_ADMIN_USER", value: "admin" },
        		{ name: "GF_SECURITY_ADMIN_PASSWORD", value: "admin" },
    ],
                }],
            },
        },
    },
});

// Grafana Service
const grafanaService = new k8s.core.v1.Service("grafana", {
    metadata: { namespace: monitoringNs.metadata.name },
    spec: {
        type: "NodePort",
        selector: { app: "grafana" },
        ports: [{ port: 3000, targetPort: 3000 }],
    },
});

// Output Grafana URL
export const grafanaUrl = grafanaService.spec.apply(s =>
    `http://localhost:${s?.ports?.[0].nodePort}`
);
