package com.google.impactdashboard.server.api_utilities;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.HttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.jackson2.JacksonFactory;
import com.google.api.services.cloudresourcemanager.CloudResourceManager;
import com.google.api.services.cloudresourcemanager.model.ListProjectsResponse;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.impactdashboard.Credentials;
import java.util.List;
import java.util.ArrayList;
import  com.google.impactdashboard.data.project.ProjectIdentification;
import com.google.common.annotations.VisibleForTesting;

/** 
 * A class for using the Cloud Resource Manager API to retrieve the projects 
 * that the credentials in use have resourcemanager.projects.get permission for. 
 */
public class ProjectListRetriever {

  private CloudResourceManager cloudResourceManagerService = null;
  private static ProjectListRetriever INSTANCE = null;

  public static ProjectListRetriever getInstance() {
    if (INSTANCE == null) {
      INSTANCE = new ProjectListRetriever(createCloudResourceManagerService());
    }
    return INSTANCE;
  }

  protected ProjectListRetriever(CloudResourceManager cloudResourceManagerService) {
    this.cloudResourceManagerService = cloudResourceManagerService;
  }

  /** 
   * Returns the list of projects that the credentials in use have 
   * resourcemanager.projects.get permissions for.  
   */
  public List<ProjectIdentification> listResourceManagerProjects() {
    try {
      CloudResourceManager.Projects.List request = cloudResourceManagerService.projects().list();
      return getListOfProjects(request);
    } catch (IOException io) {
      throw new RuntimeException("Failed to list projects: " + io.getMessage());
    }
  }

  @VisibleForTesting
  /** Returns the list of projects resulting from executing {@code request}. */
  protected static List<ProjectIdentification> getListOfProjects(
    CloudResourceManager.Projects.List request) throws IOException {
    List<ProjectIdentification> projects = new ArrayList<ProjectIdentification>();

    ListProjectsResponse response;
    do {
      response = request.execute();
      if (response.getProjects() != null) {
        response.getProjects().stream().forEach(project -> 
          projects.add(
            ProjectIdentification.create(
              project.getName(), project.getProjectId(), project.getProjectNumber())));
      }
      request.setPageToken(response.getNextPageToken());
    } while (response.getNextPageToken() != null);

    return projects;
  }

  /**
   * Returns a CloudResourceManager with the proper credentials to retrieve the 
   * list of projects that the dashboard has access to.
   */
  private static CloudResourceManager createCloudResourceManagerService() {
    HttpTransport httpTransport = null;
    try {
      httpTransport = GoogleNetHttpTransport.newTrustedTransport();
    } catch (IOException io) {
      throw new RuntimeException(
        "Failed to access Resource Manager: could not create HttpTransport, " + io.getMessage());
    } catch (GeneralSecurityException ge) {
      throw new RuntimeException(
        "Failed to access Resource Manager: could not create HttpTransport, " + ge.getMessage());
    }
    JsonFactory jsonFactory = JacksonFactory.getDefaultInstance();

    HttpCredentialsAdapter credentials = new HttpCredentialsAdapter(
      Credentials.getCredentials()
        .createScoped(Arrays.asList("https://www.googleapis.com/auth/cloud-platform")));

    return new CloudResourceManager.Builder(httpTransport, jsonFactory, credentials)
      .setApplicationName("Recommendations Impact Dashboard")
      .build();
  }
}
