package com.google.impactdashboard.server.api_utilities;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.jackson2.JacksonFactory;
import com.google.api.services.iam.v1.Iam;
import com.google.api.services.iam.v1.IamScopes;
import com.google.api.services.iam.v1.model.Role;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.audit.AuditLog;
import com.google.impactdashboard.data.IAMBindingDatabaseEntry;
import com.google.logging.v2.LogEntry;
import com.google.protobuf.InvalidProtocolBufferException;
import com.google.protobuf.Value;

import java.util.AbstractMap.SimpleImmutableEntry;
import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Class that counts number of members in each IAM role and determines the total number of bindings
 */
public class IamBindingRetriever {

  private final Map<String, Integer> mapRoleToNumberOfMembers;
  private final Iam iamService;

  protected IamBindingRetriever( Map<String, Integer> mapRoleToNumberOfMembers, Iam iamService) {
    this.mapRoleToNumberOfMembers = mapRoleToNumberOfMembers;
    this.iamService = iamService;
  }

  /**
   * Static factory for creating a new instance of IamBindingRetriever.
   * @return new Instance of IamBindingRetriever
   */
  public static IamBindingRetriever create() throws Exception {
    GoogleCredentials credentials;
    try {
      credentials = GoogleCredentials
          // The path will be changed to use the constants class when it is merged into main
          .fromStream(new FileInputStream("/usr/local/google/home/ionis/Documents/credentials.json"))
          .createScoped(Collections.singleton(IamScopes.CLOUD_PLATFORM));
    } catch (IOException e) {
      credentials = GoogleCredentials
          .fromStream(new ByteArrayInputStream(System.getenv("SERVICE_ACCOUNT_KEY").getBytes()));
    }
    Iam iamService = new Iam.Builder(GoogleNetHttpTransport.newTrustedTransport(),
        JacksonFactory.getDefaultInstance(),
        new HttpCredentialsAdapter(credentials))
        .setApplicationName("Recommendation Impact Dashboard")
        .build();
    return new IamBindingRetriever(new HashMap<>(), iamService);
  }

  /**
   * Takes audit logs and uses the IAM API with the bindings from the audit logs to
   * calculate the IAMBindingsNumber for Each log.
   * @param logEntries List of audit logs that set IAM policy
   * @return the Database entries of IAMBindings from the audit logs
   */
  public List<IAMBindingDatabaseEntry> listIAMBindingData(Collection<LogEntry> logEntries,
                                      String projectId, String projectName,
                                      String projectNumber){
    Map<Long, AuditLog> timeToAuditLogMap = logEntries.stream().map(log -> {
          AuditLog auditLog;
          try {
            auditLog = AuditLog.parseFrom(log.getProtoPayload().getValue());
          } catch (InvalidProtocolBufferException e) {
            throw new RuntimeException("Invalid Protocol Buffer used");
          }
          return new SimpleImmutableEntry<>(log.getTimestamp().getSeconds(), auditLog);
        }).collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));


    return timeToAuditLogMap.entrySet().stream().map(entry -> {
      Map<String, Integer> membersForRoles = getMembersForRoles(entry.getValue().getResponse()
          .getFieldsMap().get("bindings").getListValue().getValuesList());
      try {
        return IAMBindingDatabaseEntry.create(projectId, projectName, projectNumber, entry.getKey(),
            getIamBindings(membersForRoles));
      } catch (IOException e) {
        throw new RuntimeException("Error in getting IAM Roles");
      }
    }).collect(Collectors.toList());
  }

  /**
   * Takes in a map of protobuf value to value and updates the mapRoleToNumberOfMembers field with the new
   * role and the number of members in the role.
   * @param bindings protoBuf map for a binding map from AuditLogs
   */
  private Map<String, Integer> getMembersForRoles(List<Value> bindings) {
    Map<String, Integer> membersforRoles = new HashMap<>();
    bindings.forEach(bindingValue -> {
      Map<String, Value> bindingMap = bindingValue.getStructValue().getFieldsMap();
      membersforRoles.put(bindingMap.get("role").getStringValue(),
          bindingMap.get("member").getListValue().getValuesList().size());
    });
    return membersforRoles;
  }

  /**
   * Calls IAM API to get all roles for a project and then calculate the IAM bindings for the given map.
   * @param membersForRoles map of membersPerRole to calculate the number of total bindings.
   * @return Total number of IAMBindings for the given map
   */
  private int getIamBindings(Map<String, Integer> membersForRoles) throws IOException {
    int iamBindings;
    List<Role> roles = iamService.roles().list().execute().getRoles();
    iamBindings = roles.stream().filter(role -> membersForRoles.containsKey(role.getName()))
        .mapToInt(role -> role.getIncludedPermissions().size() * membersForRoles.get(role.getName())).sum();
    return iamBindings;
  }
}
