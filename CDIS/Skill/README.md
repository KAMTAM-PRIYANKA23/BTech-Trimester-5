\# 🚀 CDIS – Skill Programs



<p align="center">

&#x20; <img src="https://img.shields.io/badge/Course-25CS2206E-blue?style=flat-square" />

&#x20; <img src="https://img.shields.io/badge/Trimester-T5-purple?style=flat-square" />

&#x20; <img src="https://img.shields.io/badge/Academic\_Year-2026--2027-success?style=flat-square" />

&#x20; <img src="https://img.shields.io/badge/Platform-AWS-orange?style=flat-square\&logo=amazonaws" />

</p>



\## 📖 Overview



This directory contains the skill-based practical programs prescribed for \*\*Cloud Infrastructure and Services (25CS2206E)\*\* during the 2026–2027 Even Trimester (T5).



The programs provide hands-on experience with Amazon Web Services (AWS), covering cloud security, compute, storage, networking, serverless applications, databases, monitoring and access management.



\## 🎯 Objectives



\- Gain practical experience with AWS cloud services.

\- Understand cloud infrastructure configuration and management.

\- Implement identity, access and security controls.

\- Explore cloud storage, networking and compute services.

\- Develop skills in monitoring, automation and troubleshooting.

\- Understand cloud resource availability, reliability and cost management.



\## 🧰 Tools and Technologies



| Category | Tools / Services |

|---|---|

| Cloud Platform | Amazon Web Services |

| Compute | Amazon EC2, AWS Lambda |

| Storage | Amazon S3, Amazon EBS, AMI |

| Database | Amazon RDS, Amazon DynamoDB |

| Networking | Amazon VPC, NAT Gateway, Network ACL |

| Security | AWS IAM, MFA, Security Groups |

| Messaging | Amazon SQS |

| Monitoring | Amazon CloudWatch |

| Command Line | AWS CLI |

| Documentation | Screenshots, execution outputs and observations |



\## 📋 List of Skill Programs



\### 01. Identity and Access Management



| No. | Skill Program |

|---|---|

| 01 | Create an IAM user with programmatic access only, download the access key and secret key, and document the steps with screenshots. Set up a billing alert to receive an email when the Free Tier limit is about to be crossed. |

| 02 | Enable MFA on the root user and prepare a short comparison of virtual MFA devices, hardware MFA devices and FIDO security keys. |

| 21 | Attach AmazonS3ReadOnlyAccess to the Dev Team and AmazonEC2FullAccess to the Ops Team. Sign in as Dev1 and Test1 and record the actions each user can and cannot perform. |

| 22 | Write a custom IAM policy allowing a user to start and stop only instances tagged Environment=Dev. Attach it to a new group and test the permissions. |



\### 02. Compute and Storage Services



| No. | Skill Program |

|---|---|

| 03 | Launch an Ubuntu EC2 instance, install Nginx using a user data script at launch and open its default page in a browser. Compare the observations with Amazon Linux and Apache steps. |

| 04 | Enable S3 bucket versioning, upload the same file twice with changes and restore an earlier version. Configure a lifecycle rule to move objects to S3 Glacier after 30 days. |

| 05 | Write AWS CLI commands to list running instances in a region, stop an instance, start it again and terminate it. Capture the output of each command. |

| 06 | Create an AMI from a web server instance, copy it to another region and launch an instance from the copied image. Explain why AMIs are region-specific. |

| 13 | Create a snapshot of a 25 GB volume, create a new volume from it in another Availability Zone, attach it to a new instance and verify the data. |

| 14 | Add an entry in `/etc/fstab` so that an EBS volume mounts automatically after reboot. Reboot the instance and confirm that `/data` is available. |



\### 03. Serverless Computing and Messaging



| No. | Skill Program |

|---|---|

| 07 | Create an S3-triggered Lambda function that writes the uploaded object's name and size to CloudWatch Logs. |

| 08 | Modify an SQS-triggered function to fail for specific message content, configure a dead-letter queue and demonstrate the failed message reaching it. |



\### 04. Cloud Networking and Infrastructure



| No. | Skill Program |

|---|---|

| 09 | Launch one EC2 instance in a public subnet and another in a private subnet of MyVPC. Demonstrate internet reachability of the public instance and private-instance access through the public instance. |

| 10 | Create a Network ACL that denies inbound SSH from the internet to the public subnet while the security group allows it. Explain the result. |

| 11 | Launch an instance in Private1, connect through a bastion host in the public subnet and run `sudo yum update` to demonstrate NAT Gateway outbound internet access. |

| 12 | Replace the NAT Gateway with a NAT instance with source/destination checking disabled. Compare cost, availability and bandwidth. |



\### 05. Database Services and Recovery



| No. | Skill Program |

|---|---|

| 15 | Create an RDS read replica, insert rows through the primary endpoint and read them through the replica endpoint. Observe replication lag. |

| 16 | Take a manual RDS snapshot, delete the instance and restore a new instance from the snapshot. Verify that the students table exists in the restored database. |

| 23 | Restore a deleted DynamoDB table from backup under a new name, verify its items and enable point-in-time recovery. |

| 24 | Create a DynamoDB table with StudentID as the partition key and Subject as the sort key. Add marks for three students and query one student's marks. |



\### 06. Monitoring and CloudWatch



| No. | Skill Program |

|---|---|

| 17 | Install the CloudWatch agent on EC2 and add memory-utilization and disk-usage widgets to a dashboard. |

| 18 | Create a dashboard displaying metrics from two instances in two different regions and export its definition as JSON. |

| 19 | Create a composite alarm that enters the ALARM state only when both CPU utilization and NetworkIn alarms are in the ALARM state. |

| 20 | Configure an alarm action to stop an EC2 instance automatically when CPU utilization stays below 5% for 30 minutes and test it. |



\## 📝 Documentation Format



Each skill program is documented with the following sections:



1\. Aim

2\. Requirements and Tools

3\. Procedure / Configuration

4\. Implementation and Execution

5\. Screenshots and Observations

6\. Result

7\. Conclusion

8\. Important Concepts (where applicable)



\## 📁 Organization



Each program's documentation and supporting screenshots are maintained in this directory.



Suggested naming convention:



```text

Skill/

├── README.md

├── Skill-01/

├── Skill-02/

├── Skill-03/

└── ...

```



\## ⚠️ AWS Cost and Security Practices



\- Use Free Tier-eligible resources wherever applicable.

\- Verify resource pricing before creating cloud infrastructure.

\- Stop or terminate resources after completing experiments as required.

\- Delete unused resources to avoid unexpected charges.

\- Never upload AWS access keys, secret keys, passwords or private credentials.

\- Store sensitive information securely and exclude local credential files from Git.



\## 📌 Learning Outcome



The skill programs build practical knowledge of AWS infrastructure, cloud security, networking, storage, databases, serverless computing, monitoring and automation through hands-on implementation.



\---



<p align="center">

&#x20; <i>Cloud Infrastructure and Services | Skill Development | T5 – 2026–2027</i>

</p>

