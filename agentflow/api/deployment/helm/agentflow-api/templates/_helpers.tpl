{{/*
Expand the name of the chart.
*/}}
{{- define "agentflow-api.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "agentflow-api.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "agentflow-api.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "agentflow-api.labels" -}}
helm.sh/chart: {{ include "agentflow-api.chart" . }}
{{ include "agentflow-api.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "agentflow-api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "agentflow-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "agentflow-api.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "agentflow-api.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the config map
*/}}
{{- define "agentflow-api.configMapName" -}}
{{- printf "%s-config" (include "agentflow-api.fullname" .) }}
{{- end }}

{{/*
Create the name of the secret
*/}}
{{- define "agentflow-api.secretName" -}}
{{- printf "%s-secrets" (include "agentflow-api.fullname" .) }}
{{- end }}

{{/*
Create the name of the nginx config map
*/}}
{{- define "agentflow-api.nginxConfigMapName" -}}
{{- printf "%s-nginx-config" (include "agentflow-api.fullname" .) }}
{{- end }}

{{/*
Create the name of the TLS secret
*/}}
{{- define "agentflow-api.tlsSecretName" -}}
{{- printf "%s-tls" (include "agentflow-api.fullname" .) }}
{{- end }}

{{/*
Create image pull secret name
*/}}
{{- define "agentflow-api.imagePullSecretName" -}}
{{- printf "%s-pull-secret" (include "agentflow-api.fullname" .) }}
{{- end }}

{{/*
Create a default image repository with global registry override
*/}}
{{- define "agentflow-api.image" -}}
{{- $registry := .Values.image.registry }}
{{- if .Values.global.imageRegistry }}
{{- $registry = .Values.global.imageRegistry }}
{{- end }}
{{- printf "%s/%s:%s" $registry .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) }}
{{- end }}

{{/*
Return the proper Docker Image Registry Secret Names
*/}}
{{- define "agentflow-api.imagePullSecrets" -}}
{{- include "common.images.pullSecrets" (dict "images" (list .Values.image) "global" .Values.global) }}
{{- end }}

{{/*
Return the proper Storage Class
*/}}
{{- define "agentflow-api.storageClass" -}}
{{- include "common.storage.class" (dict "persistence" .Values.persistence "global" .Values.global) }}
{{- end }}

{{/*
Compile all warnings into a single message, and call fail.
*/}}
{{- define "agentflow-api.validateValues" -}}
{{- $messages := list -}}
{{- $messages := append $messages (include "agentflow-api.validateValues.replicaCount" .) -}}
{{- $messages := append $messages (include "agentflow-api.validateValues.image" .) -}}
{{- $messages := without $messages "" -}}
{{- $message := join "\n" $messages -}}
{{- if $message -}}
{{- printf "\nVALUES VALIDATION:\n%s" $message | fail -}}
{{- end -}}
{{- end -}}

{{/*
Validate values of agentflow-api - Number of replicas
*/}}
{{- define "agentflow-api.validateValues.replicaCount" -}}
{{- if and (not .Values.autoscaling.enabled) (lt (int .Values.replicaCount) 1) -}}
agentflow-api: replicaCount
    Invalid number of replicas requested. Must be greater than 0.
{{- end -}}
{{- end -}}

{{/*
Validate values of agentflow-api - Image
*/}}
{{- define "agentflow-api.validateValues.image" -}}
{{- if not .Values.image.repository -}}
agentflow-api: image.repository
    Image repository is required.
{{- end -}}
{{- if not .Values.image.tag -}}
agentflow-api: image.tag
    Image tag is required.
{{- end -}}
{{- end -}}