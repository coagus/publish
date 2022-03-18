pipeline {
    agent any    

    environment {
        LD_LIBRARY_PATH = '/opt/oracle/instantclient_19_8'
    }

    stages {
        stage('Load Project List') {
            steps {
                script {                    
                    InputCSVPath = input message:'Load xlsx file', parameters:  [file(name:'projects.xlsx', description:'Load *.xlsx file')]
                }                
            }
        }
		
		stage('Publish Project List') {
			steps {
				script {
                    sh "npm install"
                    sh "node publish.js ${InputCSVPath}"
                }
			}
		}
    }
}