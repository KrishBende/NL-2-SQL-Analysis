import mysql.connector
from collections import defaultdict
import requests
import json
import os
from dotenv import load_dotenv
import re
import time

def get_variables(api_key_name):
    
    load_dotenv()
    openrouter_key = os.getenv(api_key_name)

    nl_query=str(input("Enter your question regarding the database-"))

    return openrouter_key, nl_query

def mysql_connect(host="127.0.0.1",user="root",password="1234567890",database="classicmodels"):
    mydb = mysql.connector.connect(
            host=host,
            user=user,
            password=password,
            database=database
            )
    return mydb

def get_db_context(database):
    mycursor = database.cursor()
    mycursor.execute("""SELECT
        TABLE_SCHEMA,
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
        FROM
        INFORMATION_SCHEMA.COLUMNS
        WHERE
        TABLE_SCHEMA = 'classicmodels'
        ORDER BY
        TABLE_SCHEMA,
        TABLE_NAME,
        ORDINAL_POSITION;
                    """)

    myresult = mycursor.fetchall()
    mycursor.close()
    db_list = [[row[1], row[2], row[3], row[4], row[5]] for row in myresult]
    

    result = defaultdict(list)

    for item in db_list:
        key = item[0]
        value = item[1:]
        result[key].append(value)

    db_context_dict = dict(result)

    return db_context_dict

def query_generation(openrouter_key,result_dict,nl_query):
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "x-ai/grok-4-fast:free",
        "messages": [
                        {"role": "user",
                        "content": f"""You are a SQL generation assistant for MySQL. Generate a safe, read-only MySQL SELECT query that answers the request.
                                        - RETURN ONLY VALID EXECUTABLE SQL, NO BACKTICKS AND NO EXPLANATIONS.
                                        - Use correct column/table names from the schema.
                                        DB schema (showing tables and columns): {result_dict}
                                        User request: {nl_query}
                                    """,
                        "temperature": 0.5
                        }
        ]
    }

    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        response_data = response.json()

        model_reply = response_data["choices"][0]["message"]["content"]

    except requests.exceptions.RequestException as e:
        return(f"An error occurred during the API request: {e}")
    except json.JSONDecodeError:
        print("Failed to decode JSON response.")
        return(f"Raw response content: {response.text}")
    except Exception as e:
        return(f"An unexpected error occurred: {e}")

    return model_reply

def execute_query(model_reply,database):
    mycursor = database.cursor()
    try:
        mycursor.execute(model_reply)
        myresult = mycursor.fetchall()
        
    except Exception as e:
        return(f"Invalid query- {e}")

    finally:
        mycursor.close()

    return myresult

def explain_output(myresult,nl_query,model_reply,openrouter_key):
    time.sleep(10)
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "openrouter/sonoma-sky-alpha",
        "messages": [
            {"role": "user",
            "content": f"""
                        You are a professional SQL assistant. Answer the user's question from the result ouputted from a previous SQL query.
                        Explain it in a professional concise manner.
                        User Question: {nl_query}
                        Output- {myresult}
                        Previous Query- {model_reply}
                        """,
            "temperature": 0.5
            }
        ]
    }

    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        response_data = response.json()

        model_answer = response_data["choices"][0]["message"]["content"]
        return(model_answer)

    except requests.exceptions.RequestException as e:
        return(f"An error occurred during the API request: {e}")
    except json.JSONDecodeError:
        print("Failed to decode JSON response.")
        return(f"Raw response content: {response.text}")
    except Exception as e:
        return(f"An unexpected error occurred: {e}")
    
if __name__ == "__main__":

    openrouter_key,nl_query=get_variables("openrouter_key")
    mydb=mysql_connect()
    db_context_dict=get_db_context(database=mydb)
    model_reply=query_generation(openrouter_key=openrouter_key,result_dict=db_context_dict,nl_query=nl_query)
    print(f"SQL Generated-\n{model_reply}")
    query_result=execute_query(model_reply=model_reply,database=mydb)
    final_reply=explain_output(myresult=query_result,nl_query=nl_query,model_reply=model_reply,openrouter_key=openrouter_key)
    print(f"Model Analysis-\n{final_reply}")
