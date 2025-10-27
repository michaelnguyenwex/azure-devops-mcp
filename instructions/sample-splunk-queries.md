Splunk iislogs, raw events for a web server:

index=iislogs host=EP11CS1WBS13

 

Splunk windows event logs count by host: 

index=wineventlog source="WinEventLog:Application" host IN (EVBCPRDBTS*,BO11PPRDBTS*) | stats count by host

 

Splunk applogs by MachineName, raw events:

index=applogs MachineName=EP11CS1WBS*

 

Splunk applogs by CDB Application and MachineName, raw events:

index=applogs Application=WexHealth.CDB.Web.COBRApoint* MachineName=TDSPTS1*

 

Splunk New Employer Portal Staging, Raw Events: 

index=applogs sourcetype=CDH Application IN (WexHealth.Apps.Web.EmployerPortal,WexHealth.Apps.Web.EmployerPortal.Auth,WexHealth.CDH.Apps.Web.Data.Api,WexHealth.CDH.NewEmployerSetup.Portal) Environment=STG

 

Splunk New Employer Portal Staging Count by UserName: 

index=applogs sourcetype=CDH Application IN (WexHealth.Apps.Web.EmployerPortal,WexHealth.Apps.Web.EmployerPortal.Auth,WexHealth.CDH.Apps.Web.Data.Api,WexHealth.CDH.NewEmployerSetup.Portal) Environment=STG

| stats count by UserName

| sort count desc

 

Splunk New Employer Portal Staging Count of Exceptions by SourceContext: 

index=applogs sourcetype=CDH Application IN (WexHealth.Apps.Web.EmployerPortal,WexHealth.Apps.Web.EmployerPortal.Auth,WexHealth.CDH.Apps.Web.Data.Api,WexHealth.CDH.NewEmployerSetup.Portal) Environment=STG (@l=Error OR @l=Fatal) @x="*"

| stats count by SourceContext

 

Splunk New Employer Portal Staging Timechart by UserName: 

index=applogs sourcetype=CDH Application IN (WexHealth.Apps.Web.EmployerPortal,WexHealth.Apps.Web.EmployerPortal.Auth,WexHealth.CDH.Apps.Web.Data.Api,WexHealth.CDH.NewEmployerSetup.Portal) Environment=STG

| timechart count by UserName

 

Splunk New Employer Portal Staging Count of Exceptions over time by SourceContext: 

index=applogs sourcetype=CDH Application IN (WexHealth.Apps.Web.EmployerPortal,WexHealth.Apps.Web.EmployerPortal.Auth,WexHealth.CDH.Apps.Web.Data.Api,WexHealth.CDH.NewEmployerSetup.Portal) Environment=STG (@l=Error OR @l=Fatal) @x="*"

| timechart count by SourceContext

 

Splunk New Employer Portal Staging Count of Exceptions over time by an Exception message: 

index=applogs sourcetype=CDH Application IN (WexHealth.Apps.Web.EmployerPortal,WexHealth.Apps.Web.EmployerPortal.Auth,WexHealth.CDH.Apps.Web.Data.Api,WexHealth.CDH.NewEmployerSetup.Portal) Environment=STG (@l=Error OR @l=Fatal) @x="System.Security.Cryptography.CryptographicException*"

| timechart count

 

Splunk New Employer Portal Staging exception events outputting to a table: 

index=applogs sourcetype=CDH Application IN (WexHealth.Apps.Web.EmployerPortal,WexHealth.Apps.Web.EmployerPortal.Auth,WexHealth.CDH.Apps.Web.Data.Api,WexHealth.CDH.NewEmployerSetup.Portal) Environment=STG (@l=Error OR @l=Fatal) @x="System.Security.Cryptography.CryptographicException*" UserName="*"

| table _time,Application,@mt,@x,UserName

applogs index
CDH - Admin Portal application logs from all Environments



index=applogs Application=WexHealth.CDH.Web.Administrator​​​​
CDH - Admin Portal application logs from Production



index=applogs Environment=Prod Application=WexHealth.CDH.Web.Administrator​​​​
CDH - Consumer Portal Application logs from all Environments



index=applogs Application=WexHealth.CDH.Web.Consumer
Direct Services - Switchboard Application logs (Error/Fatal/Exceptions) from Production



index=applogs Environment=PROD Application=Switchboard.Web @l=Error OR @l=Fatal OR @x=*
Direct Services - Leap Application logs (Error/Fatal/Exceptions) from Production



index=applogs Environment=PROD Application=*LEAP* @l=Error OR @l=Fatal OR @x=*
Point - Cobra Job Queue Application logs from a Production server



index=applogs sourcetype=CPT_App_JobQueue2 host="MEU1CDB*H*P"
MBE - IdentityServer Application Logs from Production



index=applogs Environment=Prod Application=WexHealth.BE.MBE.IdentityServer
iislogs index
CDH - Admin Portal iislogs.



index=iislogs sitename=ADMIN host IN (MEU11CWEBH0101P,MEU11CWEBH0102P,MEU11CWEBH0103P,MEU11CWEBH0104P,MEU11CWEBH0105P,MEU11CWEBH0106P,MEU11CWEBH0107P,MEU11CWEBH0108P,MEU11CWEBH0109P)
CDH - Consumer Portal iislogs.



index=iislogs sitename=PARTICIPANT host IN (MEU11CWEBH0501P,MEU11CWEBH0502P,MEU11CWEBH0503P,MEU11CWEBH0504P,MEU11CWEBH0505P,MEU11CWEBH0506P,MEU11CWEBH0507P,MEU11CWEBH0508P,MEU11CWEBH0509P,MEU11CWEBH0510P,MEU11CWEBH0511P,MEU11CWEBH0512P,MEU11CWEBH0513P,MEU11CWEBH0514P,MEU11CWEBH0515P,MEU11CWEBH0516P,MEU11CWEBH0517P,MEU11CWEBH0518P,MEU11CWEBH0519P,MEU11CWEBH0520P)
Point - Search Production CDB Web/WBS server traffic.



index=iislogs host IN (MEU1CDBWEBH*P,MEU1CDBWBSH*P,MWU1CDBWEBH*P,MWU1CDBWBSH*P)
| sort _time
Azure - Search by IP to find the DNS server name, sitename, and URL’s associated to the server.



index=iislogs s_ip=10.171.132.46
| stats count by host,s_ip,sitename,cs_host,X_Original_Host
| sort host
wineventlog index
CDH - Admin Portal windows event logs



index=wineventlog sourcetype="WinEventLog:Application" host="MEU11CWEBH0101P"
CDH - Consumer Portal windows event logs



index=wineventlog sourcetype="WinEventLog:Application" host="MEU11CWEBH0501P"
Point - All ABP/CDB/RDC/PT Shared windows event logs



index=wineventlog sourcetype="WinEventLog:Application" host IN (MEU1PT*H*P,MEU1ABP*H*P,MEU1CDB*H*P,MEU1RDC*H*P
MWU1PT*H*P,MWU1ABP*H*P,MWU1CDB*H*P,MWU1RDC*H*P)
imperva index
Find Wex Health imperva events



index=imperva
Find Wex Health Partner Vanity events



index=imperva s_accountname="Partner Vanities"
Us this Splunk dashboard to see overall traffic for a site.
https://wex.splunkcloud.com/en-US/app/search/wh_impera_dashboard

Use this Splunk dashboard to search by Incident Id.

https://wex.splunkcloud.com/en-US/app/search/imperva_incidentid_dashboard

Find true blocked requests for a URL (Wildcard) and filter out client timed out connections.



index=imperva sourcetype=incapsula_s3 action=blocked url="admin.lh1ondemand.com*" act!=REQ_BAD_CLIENT_CLOSED_CONNECTION act!=REQ_BAD_SERVER_CLOSED_CONNECTION
Find blocked requests with incident ID.  (i.e. IncidentID=418000460212293665-600287478542371724)
The Incident ID is in the format <Session ID> - <Request ID>.



index=imperva "418000460212293665" "600287478542371724"
azure_diagnostic_logs index
App Gateway Access Logs Doc: Diagnostic logs - Azure Application Gateway 

Splunk dashboard to search by URL endpoint.  v1 gateways can use NTLM authentication.  v1 and v2 gateways do log differently, hence the two dashboards below.

https://wex.splunkcloud.com/en-US/app/search/azure_application_gateway_dashboard_v1

https://wex.splunkcloud.com/en-US/app/search/application_gateway_dashboard (v2)

Find all ApplicationGatewayAccessLog requests.



index=azure_diagnostic_logs category=ApplicationGatewayAccessLog
Finds ApplicationGatewayAccessLog resourceId’s listed/summarized.



index=azure_diagnostic_logs category=ApplicationGatewayAccessLog
| stats count by resourceId
V2 - Finds ApplicationGatewayAccessLog for a resourceId traffic, tabled with fields and sorted by time.



index=azure_diagnostic_logs category=ApplicationGatewayAccessLog resourceId="/SUBSCRIPTIONS/2FF2FF38-2B4E-4FCA-9C2B-1C652CCFB43D/RESOURCEGROUPS/RG-HEALTH-PP-PROD-APPGW-INTERNAL-EASTUS/PROVIDERS/MICROSOFT.NETWORK/APPLICATIONGATEWAYS/APPGW-INTERNAL-HEALTH-PP-PROD-EASTUS"
| rename time as timeUTC
| table _time,timeUTC,backendPoolName,backendSettingName,properties.clientIP,properties.httpStatus,properties.httpMethod,properties.originalHost,properties.host,properties.requestUri,properties.serverRouted,properties.serverResponseLatency,properties.serverStatus,properties.timeTaken,resourceId
| sort _time
Finds ApplicationGatewayAccessLog requests with for a specific resourced sorted by time.



index=azure_diagnostic_logs category=ApplicationGatewayAccessLog resourceId="/SUBSCRIPTIONS/2FF2FF38-2B4E-4FCA-9C2B-1C652CCFB43D/RESOURCEGROUPS/RG-HEALTH-PP-PROD-APPGW-INTERNAL-EASTUS/PROVIDERS/MICROSOFT.NETWORK/APPLICATIONGATEWAYS/APPGW-INTERNAL-HEALTH-PP-PROD-EASTUS"
| sort _time
azure_activity_logs index
Find all Azure Activity Log events.  This is similar to AWS Cloudtrail audit logs.



index=azure_activity_logs
Find change related events to an eastus application gateway, by backendpoolname or servername.



index=azure_activity_logs ("eastus" "applicationGateways") AND (("pts-web200-external") OR ("MEU1PTSWEBH20*P"))
corp_prod_paloalto index
Azure Firewall logs - Finds and tables key fields for the azure firewall logs.



index=corp_prod_paloalto dvc=MEU1* OR dvc=MWU1* action IN (blocked,allowed,failure,success)
| table _time,start_time,dvc,log_forwarding_profile,rule,action,src_ip,src_port,dest_ip,dest_port
| sort _time
Azure firewall logs dashboard.
https://wex.splunkcloud.com/en-US/app/search/wex_benefits_palo_alto_dashboard

jams index
Production Jams logs with a keyword search



index=jams "RequestedReports" OR "ClaimSubstantiationProcessor"
Production Jams logs looking for Warning/Error Events



index=jams ("Failed" OR "WARN" OR "ERROR")
Production Jams logs looking for a sproc or specific sproc logged



index=jams "Procedure or function" OR "usp_SelectFiledClaimByClaimNumber"
fileprocessor index
Production fileprocessor logs looking for Error Events



index=fileprocessor "Error"
