pipeline {
  agent {
    kubernetes {
      defaultContainer 'ubuntu'
      activeDeadlineSeconds 3600
    }
  }
  stages {
    stage('Init') {
      steps {
        checkout scm
	script {
	  def m = (env.GIT_URL =~ /(\/|:)(([^\/]+)\/)?(([^\/]+?)(\.git)?)$/)
	  if (m) {
	    org = m.group(3)
	    repo = m.group(5)
	  }
	}
      }
    }
    stage('Build') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'jenkins-dockerhub', usernameVariable: 'DOCKER_USERNAME', passwordVariable: 'DOCKER_PASSWORD'),
            usernamePassword(credentialsId: 'jenkins-ossrh', usernameVariable: 'OSSRH_USER', passwordVariable: 'OSSRH_PASS'),
            string(credentialsId: 'jenkins-gpg', variable: 'GPG_PASS')]) {
          sh 'npm install'
          sh 'grunt --force'
          sh 'cp -R dist kairosdb-datasource'
          sh 'zip -r kairosdb-datasource.zip kairosdb-datasource/'
        }
      }
    }
    stage('GitHub release') {
      when { buildingTag(); not { changeRequest() }  }
      steps {
        withCredentials([usernamePassword(credentialsId: 'brandonarp-github-token', usernameVariable: 'GITHUB_USERNAME', passwordVariable: 'GITHUB_TOKEN')]) {
          sh "github-release release --user ${org} --repo ${repo} --tag ${TAG_NAME}"
          sh "sleep 5"
          sh "github-release upload --user ${org} --repo ${repo} --tag ${TAG_NAME} --name kairosdb-datasource.zip --file kairosdb-datasource.zip"
        }
      }
    }
  }
}
