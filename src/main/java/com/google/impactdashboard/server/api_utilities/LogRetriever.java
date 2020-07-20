package com.google.impactdashboard.server.api_utilities;

import com.google.cloud.logging.v2.LoggingClient;
import com.google.cloud.logging.v2.LoggingClient.ListLogEntriesPagedResponse;
import com.google.cloud.logging.v2.LoggingSettings;
import com.google.cloud.logging.v2.stub.LoggingServiceV2StubSettings;
import com.google.impactdashboard.Credentials;
import com.google.logging.v2.ListLogEntriesRequest;
import com.google.logging.v2.LogEntry;

import java.io.IOException;
import java.util.Collection;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;


/** Class that handles all the retrieval of logs stored on the cloud logging API. */
public class LogRetriever {

  /** Cloud Logging client used to retrieve Audit logs and Recommendation logs */
  private LoggingClient logger;

  /**
   * Static factory method for creating a new LogRetriever with a new instance of Logging client.
   * @return A new instance of {@code LogRetriever}
   */
  public static LogRetriever create() throws IOException{
    LoggingServiceV2StubSettings stub = LoggingServiceV2StubSettings.newBuilder()
        .setCredentialsProvider(Credentials::getCredentials)
        .build();
    return new LogRetriever(LoggingClient.create(LoggingSettings.create(stub)));
  }

  private LogRetriever(LoggingClient logger) {
    this.logger = logger;
  }

  /**
   * Creates a {@code ListLogEntriesRequest} and retrieves all the relevant audit logs.
   * @param projectId ID of the project that the audit logs will be retrieved for.
   * @param timeFrom Latest time to retrieve logs for.
   * @return A response that contains all the relevant audit log entries that are stored by the logging API
   */
  public ListLogEntriesPagedResponse listAuditLogsResponse(String projectId, String timeFrom, int pageSize) {
    String project_id = "projects/" + projectId;
    String filter = "resource.type = project AND severity = NOTICE";
    if(!timeFrom.equals("")) {
      filter += " AND timestamp > \"" + timeFrom + "\"";
    }

    ListLogEntriesRequest.Builder builder = ListLogEntriesRequest.newBuilder()
        .setOrderBy("timestamp desc").addResourceNames(project_id);

    filter += " AND protoPayload.methodName:SetIamPolicy";
    ListLogEntriesRequest request = builder.setFilter(filter).setPageSize(pageSize).build();
    return logger.listLogEntries(request);

//    return StreamSupport.stream(response.iterateAll().spliterator(), false)
//        .collect(Collectors.toList());
  }

  /**
   * Creates a {@code ListLogEntriesRequest} and retrieves all the relevant Recommendation logs.
   * @param projectId ID of the project that the recommendation logs will be retrieved for.
   * @param timeFrom Earliest time to retrieve logs for
   * @param timeTo Latest time to retrieve logs for.
   * @return A list of all the relevant recommendation log entries that are stored by the logging API.
   */
  public ListLogEntriesPagedResponse listRecommendationLogs(String projectId, 
    String timeFrom, String timeTo) {
    String project_id = "projects/" + projectId;
    String filter = "resource.type = recommender AND " + 
      "resource.labels.recommender_id= google.iam.policy.Recommender AND " +
      "jsonPayload.state = SUCCEEDED";

    if (!timeFrom.equals("")) {
      filter += " AND timestamp >= \"" + timeFrom + "\"";
    }

    if (!timeTo.equals("")) {
      filter += " AND timestamp < \"" + timeTo + "\"";
    }

    ListLogEntriesRequest request = ListLogEntriesRequest.newBuilder()
      .setFilter(filter).setOrderBy("timestamp desc")
      .addResourceNames(project_id).build();
    
    return logger.listLogEntries(request);
  }

}
