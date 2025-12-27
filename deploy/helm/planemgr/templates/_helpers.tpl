{{- define "planemgr.name" -}}
{{- .Chart.Name -}}
{{- end -}}

{{- define "planemgr.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
